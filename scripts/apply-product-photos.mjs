/**
 * Aplica previews aprovados ao Supabase
 * Uso: node scripts/apply-product-photos.mjs [--dry-run]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  getSupabase,
  BUCKET,
  PREVIEWS,
  ON_PHOTOS,
  loadEnv,
} from './photo-update-lib.mjs'

const DRY_RUN = process.argv.includes('--dry-run')

async function getProduct(supabase, slug) {
  const { data, error } = await supabase.from('products').select('id, name, slug').eq('slug', slug).maybeSingle()
  if (error) throw error
  return data
}

async function deleteAllImages(supabase, productId) {
  const { data } = await supabase.from('product_images').select('id, storage_path').eq('product_id', productId)
  for (const img of data ?? []) {
    if (DRY_RUN) {
      console.log(`  [dry-run] delete ${img.storage_path}`)
      continue
    }
    if (!img.storage_path.startsWith('seed/')) {
      await supabase.storage.from(BUCKET).remove([img.storage_path])
    }
    await supabase.from('product_images').delete().eq('id', img.id)
  }
}

async function uploadImage(supabase, productId, productName, filePath, { isPrimary, displayOrder }) {
  const buffer = readFileSync(filePath)
  const storagePath = `${productId}/${randomUUID()}.jpg`
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  if (DRY_RUN) {
    console.log(`  [dry-run] upload ${storagePath} order=${displayOrder} primary=${isPrimary}`)
    return
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType: 'image/jpeg' })
  if (upErr) throw upErr

  const { error } = await supabase.from('product_images').insert({
    product_id: productId,
    url: publicData.publicUrl,
    storage_path: storagePath,
    alt: productName,
    is_primary: isPrimary,
    display_order: displayOrder,
  })
  if (error) throw error
}

async function ensureAzulClaro(supabase) {
  const existing = await getProduct(supabase, 'camisa-on-azul-claro')
  if (existing) return existing

  const { data: cats } = await supabase.from('categories').select('id').eq('slug', 't-shirts').single()
  if (!cats) throw new Error('Categoria t-shirts não encontrada')

  if (DRY_RUN) {
    console.log('  [dry-run] criar camisa-on-azul-claro')
    return { id: 'dry-run-id', name: 'camisa on azul claro', slug: 'camisa-on-azul-claro' }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: 'camisa on azul claro',
      slug: 'camisa-on-azul-claro',
      price: 99,
      status: 'draft',
      featured: false,
      is_new: true,
      category_id: cats.id,
    })
    .select('id, name, slug')
    .single()
  if (error) throw error

  await supabase.from('product_variants').insert({
    product_id: data.id,
    size_label: 'M',
    quantity: 0,
    active: true,
    display_order: 0,
  })

  console.log('  Criado produto camisa-on-azul-claro')
  return data
}

async function applyProduct(supabase, entry) {
  let product = await getProduct(supabase, entry.slug)
  if (!product && entry.slug === 'camisa-on-azul-claro') {
    product = await ensureAzulClaro(supabase)
  }
  if (!product) {
    console.warn(`SKIP ${entry.slug} — produto não encontrado`)
    return
  }

  const dir = join(PREVIEWS, entry.slug)
  if (!existsSync(dir)) {
    console.warn(`SKIP ${entry.slug} — pasta preview ausente`)
    return
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.jpg'))
    .sort()

  console.log(`APPLY ${entry.slug} (${files.length} fotos)`)
  await deleteAllImages(supabase, product.id)

  for (let i = 0; i < files.length; i++) {
    await uploadImage(supabase, product.id, product.name, join(dir, files[i]), {
      isPrimary: i === 0,
      displayOrder: i + 1,
    })
  }
}

async function main() {
  loadEnv()
  const manifestPath = join(PREVIEWS, 'manifest.json')
  if (!existsSync(manifestPath)) {
    console.error('Execute primeiro: node scripts/preview-product-photos.mjs')
    process.exit(1)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const supabase = getSupabase()

  console.log(DRY_RUN ? '=== DRY RUN APPLY ===' : '=== APLICANDO AO SUPABASE ===\n')

  let ok = 0
  let fail = 0
  for (const entry of manifest.products) {
    try {
      await applyProduct(supabase, entry)
      ok++
    } catch (err) {
      fail++
      console.error(`FAIL ${entry.slug}:`, err.message)
    }
  }

  console.log(`\nResumo: ok=${ok} falhas=${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
