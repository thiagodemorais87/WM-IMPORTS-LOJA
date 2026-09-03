/**
 * Atualização de fotos — lote 2
 * Uso: node scripts/update-product-photos.mjs [--dry-run]
 * Requer VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (.env / .env.local).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const BUCKET = 'product-images'
const MAX_EDGE = 1600
const JPEG_QUALITY = 82
const DRY_RUN = process.argv.includes('--dry-run')

const SOURCES = resolve('scripts/assets/photo-update/sources')

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

/** Recorte quadrado, resize e compressão JPEG */
async function processImage(input, { left, top, width, height, saturation = 1, hue = 0 } = {}) {
  let pipeline = sharp(input)
  if (left != null && top != null && width != null && height != null) {
    pipeline = pipeline.extract({
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
    })
  }
  pipeline = pipeline.resize(MAX_EDGE, MAX_EDGE, { fit: 'cover', position: 'centre' })
  if (saturation !== 1 || hue !== 0) {
    pipeline = pipeline.modulate({ saturation, hue })
  }
  return pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
}

/** Corrige foto "troncha" — força proporção quadrada com cover */
async function fixDistorted(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  const size = Math.min(w, h)
  const left = Math.round((w - size) / 2)
  const top = Math.round((h - size) / 2)
  return sharp(buffer)
    .extract({ left, top, width: size, height: size })
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'cover' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

async function downloadUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

// --- Coordenadas de recorte (imagens inspecionadas) ---

/** shorts-trydfit-ref.jpg 471×1024 — diagonal top-left → bottom-right */
const SHORTS_CROPS = {
  'short-trydfit-preto': { left: 0, top: 55, width: 210, height: 210 },
  'short-trydfit-creme': { left: 45, top: 145, width: 210, height: 210 },
  'short-trydfit-caqui': { left: 85, top: 270, width: 220, height: 220 },
  'marrom-trydfit': { left: 85, top: 270, width: 220, height: 220, saturation: 0.85, hue: 15 },
  'short-trydfit-azul': { left: 130, top: 400, width: 220, height: 220 },
  'short-trydfit-verde': { left: 175, top: 560, width: 240, height: 240 },
}

/** on-camisetas-flatlay.jpg 711×1024 */
const ON_CROPS = {
  'camisa-on-branca': { left: 270, top: 30, width: 300, height: 300 },
  'camisa-on-preta-2': { left: 30, top: 170, width: 300, height: 300 },
  'camisa-on-preta': { left: 330, top: 290, width: 300, height: 300 },
  'camisa-on-verde-claro': { left: 50, top: 480, width: 320, height: 320, saturation: 1.35, hue: 5 },
}

async function getProduct(supabase, slug) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`Produto não encontrado: ${slug}`)
  return data
}

async function getImages(supabase, productId) {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('display_order')
  if (error) throw error
  return data ?? []
}

async function uploadAndInsert(supabase, productId, productName, buffer, { isPrimary = false, displayOrder = 1 }) {
  const storagePath = `${productId}/${randomUUID()}.jpg`
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

  if (DRY_RUN) {
    console.log(`  [dry-run] upload ${storagePath} (${buffer.length} bytes, primary=${isPrimary}, order=${displayOrder})`)
    return { id: 'dry-run', storage_path: storagePath, url: publicData.publicUrl }
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { upsert: true, contentType: 'image/jpeg' })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      url: publicData.publicUrl,
      storage_path: storagePath,
      alt: productName,
      is_primary: isPrimary,
      display_order: displayOrder,
    })
    .select('*')
    .single()
  if (error) throw error
  return data
}

async function deleteImage(supabase, image) {
  if (DRY_RUN) {
    console.log(`  [dry-run] delete ${image.storage_path}`)
    return
  }
  if (!image.storage_path.startsWith('seed/')) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.storage_path])
    if (storageError) console.warn(`  aviso storage: ${storageError.message}`)
  }
  const { error } = await supabase.from('product_images').delete().eq('id', image.id)
  if (error) throw error
}

async function replaceAllImages(supabase, product, buffers) {
  const existing = await getImages(supabase, product.id)
  for (const img of existing) await deleteImage(supabase, img)
  for (let i = 0; i < buffers.length; i++) {
    await uploadAndInsert(supabase, product.id, product.name, buffers[i], {
      isPrimary: i === 0,
      displayOrder: i + 1,
    })
  }
}

async function replacePrimary(supabase, product, buffer) {
  const existing = await getImages(supabase, product.id)
  const primary = existing.find((img) => img.is_primary) ?? existing[0]
  if (primary) await deleteImage(supabase, primary)
  const remaining = existing.filter((img) => img.id !== primary?.id)
  await uploadAndInsert(supabase, product.id, product.name, buffer, { isPrimary: true, displayOrder: 1 })
  for (let i = 0; i < remaining.length; i++) {
    if (DRY_RUN) continue
    await supabase
      .from('product_images')
      .update({ display_order: i + 2, is_primary: false })
      .eq('id', remaining[i].id)
  }
}

async function replaceLastImage(supabase, product, buffer) {
  const existing = await getImages(supabase, product.id)
  const last = existing[existing.length - 1]
  if (!last) throw new Error(`Sem imagens para ${product.slug}`)
  await deleteImage(supabase, last)
  await uploadAndInsert(supabase, product.id, product.name, buffer, {
    isPrimary: last.is_primary,
    displayOrder: last.display_order,
  })
}

async function addImage(supabase, product, buffer) {
  const existing = await getImages(supabase, product.id)
  const nextOrder = existing.length ? Math.max(...existing.map((i) => i.display_order)) + 1 : 1
  await uploadAndInsert(supabase, product.id, product.name, buffer, {
    isPrimary: false,
    displayOrder: nextOrder,
  })
}

async function addImages(supabase, product, buffers) {
  for (const buffer of buffers) await addImage(supabase, product, buffer)
}

// --- Ações por produto ---

async function actionShortCloseup(supabase, slug) {
  const crop = SHORTS_CROPS[slug]
  const product = await getProduct(supabase, slug)
  const source = join(SOURCES, 'shorts-trydfit-ref.jpg')
  const buffer = await processImage(source, crop)
  console.log(`ADD close-up → ${product.name}`)
  await addImage(supabase, product, buffer)
}

async function actionOculosAddProduct(supabase, slug) {
  const product = await getProduct(supabase, slug)
  const buf1 = await processImage(join(SOURCES, 'oculos-produto-1.jpg'), {})
  const buf2 = await processImage(join(SOURCES, 'oculos-produto-2.jpg'), {})
  console.log(`ADD fotos produto → ${product.name}`)
  await addImages(supabase, product, [buf1, buf2])
}

async function actionFumacaRetangular(supabase) {
  const product = await getProduct(supabase, 'fumaca-retangular')
  const images = await getImages(supabase, product.id)
  if (images.length < 2) {
    console.log(`SKIP fumaca-retangular — menos de 2 imagens`)
    return
  }
  // Remove a última (geralmente foto de produto diferente); mantém modelo
  const toRemove = images[images.length - 1]
  console.log(`REMOVE foto diferente → ${product.name} (${toRemove.storage_path})`)
  await deleteImage(supabase, toRemove)
  // Adiciona foto de produto dos óculos cristal como referência de detalhe
  const buffer = await processImage(join(SOURCES, 'oculos-produto-2.jpg'), {})
  console.log(`ADD foto detalhe → ${product.name}`)
  await addImage(supabase, product, buffer)
}

async function actionAdidasNeon(supabase) {
  const product = await getProduct(supabase, 'adidas-neon-amarela')
  const images = await getImages(supabase, product.id)
  const last = images[images.length - 1]
  if (!last) throw new Error('adidas-neon-amarela sem imagens')
  console.log(`FIX última foto (troncho) → ${product.name}`)
  const raw = await downloadUrl(last.url)
  const fixed = await fixDistorted(raw)
  await replaceLastImage(supabase, product, fixed)
}

async function actionAdidasPreta(supabase) {
  const product = await getProduct(supabase, 'adidas-preta-logo-manga')
  const buffer = await processImage(join(SOURCES, 'adidas-preta-logo.jpg'), {})
  console.log(`REPLACE capa (logo peito) → ${product.name}`)
  await replacePrimary(supabase, product, buffer)
}

async function actionOnShirt(supabase, slug) {
  const crop = ON_CROPS[slug]
  const product = await getProduct(supabase, slug)
  const source = join(SOURCES, 'on-camisetas-flatlay.jpg')
  const buffer = await processImage(source, crop)
  console.log(`REPLACE fotos achatadas → ${product.name}`)
  await replaceAllImages(supabase, product, [buffer])
}

async function fixSlugCinza(supabase) {
  const { data, error } = await supabase
    .from('products')
    .select('id, slug')
    .eq('slug', 'camisa-on-preta')
    .maybeSingle()
  if (error) throw error
  if (!data) {
    console.log('SKIP slug fix — camisa-on-preta não encontrado')
    return
  }
  // Só corrige se for a camisa cinza (nome contém cinza)
  const { data: full } = await supabase.from('products').select('name').eq('id', data.id).single()
  if (!full?.name?.toLowerCase().includes('cinza')) {
    console.log('SKIP slug fix — camisa-on-preta não é cinza')
    return
  }
  console.log('FIX slug camisa-on-preta → camisa-on-cinza')
  if (!DRY_RUN) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ slug: 'camisa-on-cinza' })
      .eq('id', data.id)
    if (updateError) throw updateError
  }
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  for (const f of ['shorts-trydfit-ref.jpg', 'oculos-produto-1.jpg', 'oculos-produto-2.jpg', 'on-camisetas-flatlay.jpg', 'adidas-preta-logo.jpg']) {
    if (!existsSync(join(SOURCES, f))) {
      console.error(`Fonte ausente: ${join(SOURCES, f)}`)
      process.exit(1)
    }
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== ATUALIZANDO FOTOS ===')
  console.log('')

  let ok = 0
  let fail = 0

  const tasks = [
    ...Object.keys(SHORTS_CROPS).map((slug) => () => actionShortCloseup(supabase, slug)),
    () => actionFumacaRetangular(supabase),
    () => actionOculosAddProduct(supabase, 'cristal-redondo'),
    () => actionOculosAddProduct(supabase, 'creme-translucido'),
    () => actionAdidasNeon(supabase),
    () => actionAdidasPreta(supabase),
    () => actionOnShirt(supabase, 'camisa-on-preta-2'),
    () => actionOnShirt(supabase, 'camisa-on-preta'), // slug corrigido depois
    () => actionOnShirt(supabase, 'camisa-on-branca'),
    () => actionOnShirt(supabase, 'camisa-on-verde-claro'),
    () => fixSlugCinza(supabase),
  ]

  for (const task of tasks) {
    try {
      await task()
      ok += 1
    } catch (err) {
      fail += 1
      console.error(`FAIL: ${err?.message || err}`)
    }
  }

  console.log('')
  console.log(`Resumo: ok=${ok} falhas=${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
