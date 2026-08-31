/**
 * Import one-off — lote 2 (nome + fotos + R$ 99 em draft)
 * Uso: node scripts/import-lote2.mjs
 * Requer VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env / .env.local).
 *
 * Fonte padrão:
 *   %USERPROFILE%\Downloads\fotos-lote2-fullhd\lote2
 * Override: LOTE2_PATH=...
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, extname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const PRICE = 99
const BUCKET = 'product-images'
const CATEGORY_BY_FOLDER = {
  camisetas: 't-shirts',
  oculos: 'acessorios',
  shorts: 'calcas',
}

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return

  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80)
}

function folderToName(folderName) {
  const withoutNum = folderName.replace(/^\d+-/, '')
  return withoutNum
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function listProductDirs(loteRoot) {
  const products = []
  for (const [folder, categorySlug] of Object.entries(CATEGORY_BY_FOLDER)) {
    const typeDir = join(loteRoot, folder)
    if (!existsSync(typeDir)) {
      console.warn(`Pasta ausente: ${typeDir}`)
      continue
    }
    for (const entry of readdirSync(typeDir).sort()) {
      const productDir = join(typeDir, entry)
      if (!statSync(productDir).isDirectory()) continue
      const images = readdirSync(productDir)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort()
        .map((f) => join(productDir, f))
      if (!images.length) {
        console.warn(`Sem imagens: ${productDir}`)
        continue
      }
      products.push({
        folderName: entry,
        name: folderToName(entry),
        categorySlug,
        sizeLabel: folder === 'oculos' ? 'Único' : 'M',
        images,
      })
    }
  }
  return products
}

async function uniqueSlug(supabase, name) {
  const base = slugify(name) || `produto-${Date.now()}`
  const { data, error } = await supabase.from('products').select('slug').like('slug', `${base}%`)
  if (error) throw error
  const existing = new Set((data ?? []).map((row) => row.slug))
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error(
      'Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env ou .env.local.',
    )
    process.exit(1)
  }

  const loteRoot =
    process.env.LOTE2_PATH ||
    join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'fotos-lote2-fullhd', 'lote2')

  if (!existsSync(loteRoot)) {
    console.error(`Pasta do lote não encontrada: ${loteRoot}`)
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: categories, error: catError } = await supabase.from('categories').select('id, slug')
  if (catError) throw catError
  const categoryIdBySlug = new Map((categories ?? []).map((c) => [c.slug, c.id]))

  for (const slug of Object.values(CATEGORY_BY_FOLDER)) {
    if (!categoryIdBySlug.has(slug)) {
      console.error(`Categoria não encontrada no banco: ${slug}`)
      process.exit(1)
    }
  }

  const products = listProductDirs(loteRoot)
  console.log(`Encontrados ${products.length} produtos em ${loteRoot}`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const product of products) {
    const baseSlug = slugify(product.name)
    const { data: existingRows, error: existError } = await supabase
      .from('products')
      .select('id, slug')
      .eq('slug', baseSlug)
      .maybeSingle()

    if (existError) {
      console.error(`ERRO checando ${product.name}:`, existError.message)
      failed += 1
      continue
    }

    if (existingRows) {
      console.log(`SKIP  ${product.name} (slug já existe: ${baseSlug})`)
      skipped += 1
      continue
    }

    try {
      const slug = await uniqueSlug(supabase, product.name)
      const categoryId = categoryIdBySlug.get(product.categorySlug)

      const { data: inserted, error: insertError } = await supabase
        .from('products')
        .insert({
          name: product.name,
          slug,
          price: PRICE,
          status: 'draft',
          featured: false,
          is_new: true,
          category_id: categoryId,
          description: null,
          additional_info: null,
          sku: null,
          promotional_price: null,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      const productId = inserted.id

      const { error: variantError } = await supabase.from('product_variants').insert({
        product_id: productId,
        size_label: product.sizeLabel,
        sku: null,
        quantity: 0,
        active: true,
        display_order: 0,
      })
      if (variantError) throw variantError

      const imageRows = []
      for (let i = 0; i < product.images.length; i += 1) {
        const filePath = product.images[i]
        const ext = (extname(filePath).replace('.', '') || 'jpg').toLowerCase()
        const storagePath = `${productId}/${randomUUID()}.${ext}`
        const body = readFileSync(filePath)
        const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, body, { upsert: true, contentType })
        if (uploadError) throw uploadError

        const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
        imageRows.push({
          product_id: productId,
          url: publicData.publicUrl,
          storage_path: storagePath,
          alt: product.name,
          is_primary: i === 0,
          display_order: i,
        })
      }

      const { error: imagesError } = await supabase.from('product_images').insert(imageRows)
      if (imagesError) throw imagesError

      console.log(
        `OK    ${product.name} → ${slug} (${product.images.length} fotos, cat=${product.categorySlug})`,
      )
      created += 1
    } catch (err) {
      console.error(`FAIL  ${product.name}:`, err?.message || err)
      failed += 1
    }
  }

  console.log('')
  console.log(`Resumo: criados=${created} pulados=${skipped} falhas=${failed} total=${products.length}`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
