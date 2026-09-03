/**
 * Gera previews locais — lote 2 v2
 * Uso: node scripts/preview-product-photos.mjs
 * Saída: scripts/assets/photo-update/previews/ + INDEX.html
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  copyFileSync,
  unlinkSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import {
  getSupabase,
  downloadUrl,
  SHORTS_CROPS,
  SHORTS_CLOSEUPS,
  ADIDAS_PRIMARY,
  findSourceFile,
  ON_PHOTOS,
  OCULOS_PRODUCT_REFS,
  DRAFT_SLUGS,
  SOURCES,
  PREVIEWS,
  MAX_EDGE,
  JPEG_QUALITY,
} from './photo-update-lib.mjs'

const ON_DIR = join(SOURCES, 'on')
const OCULOS_DIR = join(SOURCES, 'oculos-referencia')
const SHORTS_DIR = join(SOURCES, 'shorts')
const ADIDAS_DIR = join(SOURCES, 'adidas')
const manifest = { generatedAt: new Date().toISOString(), products: [] }

async function toJpeg(input, opts = {}) {
  let p = sharp(input)
  if (opts.left != null) {
    p = p.extract({
      left: Math.round(opts.left),
      top: Math.round(opts.top),
      width: Math.round(opts.width),
      height: Math.round(opts.height),
    })
  }
  p = p.resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: false })
  if (opts.saturation && opts.saturation !== 1) p = p.modulate({ saturation: opts.saturation })
  return p.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
}

async function savePreview(slug, filename, buffer, meta = {}) {
  const dir = join(PREVIEWS, slug)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, filename)
  writeFileSync(path, buffer)
  return { path, filename, ...meta }
}

function clearPreviewDir(slug) {
  const dir = join(PREVIEWS, slug)
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.jpg')) unlinkSync(join(dir, f))
  }
}

function findOnFile(prefix) {
  const files = readdirSync(ON_DIR)
  const match = files.find((f) => f.startsWith(prefix))
  if (!match) throw new Error(`Foto On não encontrada: ${prefix}`)
  return join(ON_DIR, match)
}

async function getProductImages(supabase, slug) {
  const product = await getProduct(supabase, slug)
  if (!product) return null
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', product.id)
    .order('display_order')
  if (error) throw error
  return { ...product, product_images: data ?? [] }
}

async function getProduct(supabase, slug) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, status')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data
}

async function getArchivedOculos(supabase) {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, status, category:categories(slug), product_images(*)')
    .in('status', ['draft', 'archived'])
  if (error) throw error
  return (data ?? []).filter(
    (p) => p.category?.slug === 'acessorios' && DRAFT_SLUGS.oculos.includes(p.slug),
  )
}

/** Corrige proporção achatada — restaura aspect ratio natural */
async function fixSquashed(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  // Fotos achatadas costumam ser muito largas; esticar verticalmente ~15%
  if (w / h > 1.3) {
    const newH = Math.round(h * 1.18)
    return sharp(buffer)
      .resize(w, newH, { fit: 'fill' })
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()
  }
  return toJpeg(buffer)
}

/** Corrige símbolo troncho no braço — crop na região inferior e resize proporcional */
async function fixNeonArmSymbol(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  // Corrige distorção horizontal típica em fotos de manga
  const targetRatio = 3 / 4
  const currentRatio = w / h
  let pipeline = sharp(buffer)
  if (currentRatio > targetRatio * 1.1) {
    const newW = Math.round(h * targetRatio)
    const left = Math.round((w - newW) / 2)
    pipeline = pipeline.extract({ left, top: 0, width: newW, height: h })
  }
  return pipeline
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside' })
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

/** Extrai logo Adidas do peito e compõe em foto de modelo */
async function compositeAdidasLogo(modelBuffer, logoRefPath) {
  const logoRef = await sharp(logoRefPath).metadata()
  const refW = logoRef.width ?? 768
  // Região do logo na foto de referência (~15% largura, posição peito esquerdo)
  const logoW = Math.round(refW * 0.12)
  const logoH = Math.round(logoW * 0.85)
  const logoLeft = Math.round(refW * 0.22)
  const logoTop = Math.round((logoRef.height ?? 1024) * 0.28)

  const logo = await sharp(logoRefPath)
    .extract({ left: logoLeft, top: logoTop, width: logoW, height: logoH })
    .toBuffer()

  const modelMeta = await sharp(modelBuffer).metadata()
  const mw = modelMeta.width ?? 1
  const mh = modelMeta.height ?? 1
  const scale = mw / refW
  const destW = Math.round(logoW * scale)
  const destH = Math.round(logoH * scale)
  const destLeft = Math.round(logoLeft * scale)
  const destTop = Math.round(logoTop * scale)

  const resizedLogo = await sharp(logo).resize(destW, destH).toBuffer()

  return sharp(modelBuffer)
    .composite([{ input: resizedLogo, left: destLeft, top: destTop }])
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

async function processShorts(supabase) {
  const shortsRef = join(SOURCES, 'shorts-trydfit-ref.jpg')
  for (const slug of DRAFT_SLUGS.shorts) {
    const product = await getProductImages(supabase, slug)
    if (!product) continue
    clearPreviewDir(slug)
    const images = product.product_images.sort((a, b) => a.display_order - b.display_order)
    const entry = { slug, name: product.name, action: 'manter 3 modelos + 1 close-up', files: [] }

    // Manter primeiras 3 (modelos)
    for (let i = 0; i < Math.min(3, images.length); i++) {
      const buf = await downloadUrl(images[i].url)
      const saved = await savePreview(slug, `0${i + 1}-modelo-${i + 1}.jpg`, await fixSquashed(buf), {
        action: 'manter',
        source: 'supabase',
      })
      entry.files.push(saved)
    }

    // Close-up: foto real em sources/shorts ou fallback flatlay (marrom)
    const closeupPrefix = SHORTS_CLOSEUPS[slug]
    const closeupSrc = closeupPrefix ? findSourceFile(SHORTS_DIR, closeupPrefix) : null
    let closeup
    let closeupSource = 'shorts-ref'
    if (closeupSrc) {
      closeup = await toJpeg(closeupSrc)
      closeupSource = closeupSrc
    } else {
      const crop = SHORTS_CROPS[slug]
      closeup = await toJpeg(shortsRef, crop)
    }
    const saved = await savePreview(slug, '04-closeup.jpg', closeup, { action: 'adicionar', source: closeupSource })
    entry.files.push(saved)

    manifest.products.push(entry)
    console.log(`OK shorts ${slug}`)
  }
}

async function processOculos(supabase) {
  const archived = await getArchivedOculos(supabase)
  for (const product of archived) {
    const images = (product.product_images ?? []).sort((a, b) => a.display_order - b.display_order)
    const entry = { slug: product.slug, name: product.name, action: 'manter modelos + refs corretas', files: [] }

    // Manter fotos de modelo (primeiras 1-2 — pessoa real)
    const modelCount = Math.min(2, images.length)
    for (let i = 0; i < modelCount; i++) {
      const buf = await downloadUrl(images[i].url)
      const saved = await savePreview(product.slug, `0${i + 1}-modelo-${i + 1}.jpg`, await fixSquashed(buf), {
        action: 'manter',
        source: 'supabase',
      })
      entry.files.push(saved)
    }

    // Fotos de produto corretas das refs
    const refs = OCULOS_PRODUCT_REFS[product.slug] ?? []
    for (let i = 0; i < refs.length; i++) {
      const refPath = join(OCULOS_DIR, refs[i])
      if (!existsSync(refPath)) continue
      const buf = await toJpeg(refPath)
      const saved = await savePreview(product.slug, `0${modelCount + i + 1}-produto-${i + 1}.jpg`, buf, {
        action: 'adicionar/substituir',
        source: refs[i],
      })
      entry.files.push(saved)
    }

    manifest.products.push(entry)
    console.log(`OK oculos ${product.slug}`)
  }
}

async function processAdidas(supabase) {
  // Neon — frente corrigida como capa + manter fotos 2 e 3 do Supabase
  const neon = await getProductImages(supabase, 'adidas-neon-amarela')
  if (neon) {
    clearPreviewDir(neon.slug)
    const images = neon.product_images.sort((a, b) => a.display_order - b.display_order)
    const entry = { slug: neon.slug, name: neon.name, action: 'frente corrigida + manter 2 fotos', files: [] }

    const primaryPrefix = ADIDAS_PRIMARY[neon.slug]
    const primarySrc = findSourceFile(ADIDAS_DIR, primaryPrefix)
    if (!primarySrc) throw new Error(`Foto Adidas não encontrada: ${primaryPrefix}`)

    const primaryBuf = await toJpeg(primarySrc)
    entry.files.push(
      await savePreview(neon.slug, '01-frente-corrigida.jpg', primaryBuf, {
        action: 'substituir capa',
        isPrimary: true,
      }),
    )

    for (let i = 1; i < Math.min(3, images.length); i++) {
      const buf = await downloadUrl(images[i].url)
      const saved = await savePreview(neon.slug, `0${i + 1}-manter.jpg`, await fixSquashed(buf), {
        action: 'manter',
      })
      entry.files.push(saved)
    }

    manifest.products.push(entry)
    console.log('OK adidas neon')
  }

  // Preta — só frente corrigida
  const preta = await getProductImages(supabase, 'adidas-preta-logo-manga')
  if (preta) {
    clearPreviewDir(preta.slug)
    const entry = { slug: preta.slug, name: preta.name, action: 'frente corrigida', files: [] }

    const primaryPrefix = ADIDAS_PRIMARY[preta.slug]
    const primarySrc = findSourceFile(ADIDAS_DIR, primaryPrefix)
    if (!primarySrc) throw new Error(`Foto Adidas não encontrada: ${primaryPrefix}`)

    const primaryBuf = await toJpeg(primarySrc)
    entry.files.push(
      await savePreview(preta.slug, '01-frente-corrigida.jpg', primaryBuf, {
        action: 'substituir',
        isPrimary: true,
      }),
    )

    manifest.products.push(entry)
    console.log('OK adidas preta')
  }
}

async function processOn(supabase) {
  for (const [slug, prefixes] of Object.entries(ON_PHOTOS)) {
    const labels = ['frente', 'costas', 'detalhe']
    const entry = { slug, action: 'substituir por fotos modelo novas', files: [], isNew: slug === 'camisa-on-azul-claro' }

    const product = await getProduct(supabase, slug)
    entry.name = product?.name ?? slug.replace(/-/g, ' ')

    for (let i = 0; i < prefixes.length; i++) {
      const file = findOnFile(prefixes[i])
      let buf = await toJpeg(file)
      if (slug === 'camisa-on-verde-claro' && labels[i] === 'frente') {
        buf = await toJpeg(file, { saturation: 1.25 })
      }
      const saved = await savePreview(slug, `0${i + 1}-${labels[i]}.jpg`, buf, {
        action: 'substituir',
        isPrimary: i === 0,
      })
      entry.files.push(saved)
    }
    manifest.products.push(entry)
    console.log(`OK on ${slug}`)
  }
}

function generateIndex() {
  const sections = manifest.products
    .map((p) => {
      const imgs = p.files
        .map(
          (f) =>
            `<div class="card"><img src="${p.slug}/${f.filename}" alt="${f.filename}"/><p>${f.filename}<br/><small>${f.action ?? ''}</small></div>`,
        )
        .join('')
      return `<section><h2>${p.name ?? p.slug} <code>${p.slug}</code>${p.isNew ? ' <span class="badge">NOVO</span>' : ''}</h2><p>${p.action}</p><div class="grid">${imgs}</div></section>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><title>Preview Fotos Lote 2</title>
<style>
body{font-family:system-ui,sans-serif;background:#111;color:#eee;padding:2rem;max-width:1400px;margin:0 auto}
h1{color:#fff} section{margin-bottom:3rem;border-bottom:1px solid #333;padding-bottom:2rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
.card{background:#1a1a1a;border-radius:12px;overflow:hidden;padding:.5rem}
.card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
.badge{background:#f59e0b;color:#000;padding:2px 8px;border-radius:4px;font-size:.75rem}
code{background:#333;padding:2px 6px;border-radius:4px;font-size:.85rem}
small{color:#888}
</style></head><body>
<h1>Preview — Correção Fotos Lote 2 (v2)</h1>
<p>Gerado em ${manifest.generatedAt}. Revise cada produto antes de aprovar o upload.</p>
${sections}
</body></html>`

  writeFileSync(join(PREVIEWS, 'INDEX.html'), html)
  writeFileSync(join(PREVIEWS, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

async function main() {
  mkdirSync(PREVIEWS, { recursive: true })
  const supabase = getSupabase()

  console.log('=== GERANDO PREVIEWS ===\n')
  await processShorts(supabase)
  await processOculos(supabase)
  await processAdidas(supabase)
  await processOn(supabase)
  generateIndex()

  console.log(`\nPreviews em: ${PREVIEWS}`)
  console.log(`Abra: ${join(PREVIEWS, 'INDEX.html')}`)
  console.log(`Produtos: ${manifest.products.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
