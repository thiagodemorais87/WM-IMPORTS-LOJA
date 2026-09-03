/**
 * Gera pacote final em scripts/assets/photo-update/entrega/
 * NÃO faz upload no Supabase — só arquivos locais para upload manual.
 *
 * Uso: node scripts/generate-entrega.mjs
 */

import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import {
  getSupabase,
  downloadUrl,
  OCULOS_PRODUCT_REFS,
  DRAFT_SLUGS,
  ON_PHOTOS,
  SOURCES,
  JPEG_QUALITY,
} from './photo-update-lib.mjs'

const ENTREGA = resolve('scripts/assets/photo-update/entrega')
const ON_DIR = join(SOURCES, 'on')
const OCULOS_DIR = join(SOURCES, 'oculos-referencia')
const manifest = { generatedAt: new Date().toISOString(), products: [] }

/** Corrige fotos achatadas (muito largas → proporção natural 4:5) */
async function fixProporcaoModelo(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  const ratio = w / h

  // Fotos muito largas: recorte central em proporção 4:5 (retrato)
  if (ratio > 1.15) {
    const targetRatio = 4 / 5
    const cropW = Math.round(h * targetRatio)
    const left = Math.round((w - cropW) / 2)
    return sharp(buffer)
      .extract({ left: Math.max(0, left), top: 0, width: Math.min(cropW, w), height: h })
      .resize(1200, 1500, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()
  }

  return sharp(buffer)
    .resize(1200, 1500, { fit: 'inside', withoutEnlargement: false })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()
}

/** Corrige símbolo troncho no braço — restaura proporção vertical na região */
async function fixNeonBraco(buffer) {
  const meta = await sharp(buffer).metadata()
  const w = meta.width ?? 1
  const h = meta.height ?? 1
  // Se muito larga, recorta para 3:4 mantendo centro (símbolo no braço)
  const targetRatio = 3 / 4
  if (w / h > targetRatio) {
    const newW = Math.round(h * targetRatio)
    const left = Math.round((w - newW) / 2)
    return sharp(buffer)
      .extract({ left, top: 0, width: newW, height: h })
      .resize(1200, 1600, { fit: 'inside' })
      .sharpen({ sigma: 0.6 })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer()
  }
  return sharp(buffer).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
}

async function compositeAdidasLogo(modelBuffer, logoRefPath) {
  const logoRef = await sharp(logoRefPath).metadata()
  const refW = logoRef.width ?? 768
  const logoW = Math.round(refW * 0.12)
  const logoH = Math.round(logoW * 0.85)
  const logoLeft = Math.round(refW * 0.22)
  const logoTop = Math.round((logoRef.height ?? 1024) * 0.28)

  const logo = await sharp(logoRefPath)
    .extract({ left: logoLeft, top: logoTop, width: logoW, height: logoH })
    .toBuffer()

  const modelMeta = await sharp(modelBuffer).metadata()
  const mw = modelMeta.width ?? 1
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

function findSourceFile(dir, prefix) {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && /\.jpe?g$/i.test(f))
  if (!files.length) return null
  files.sort()
  const path = join(dir, files[files.length - 1])
  return existsSync(path) ? path : null
}

async function saveEntrega(slug, filename, buffer, meta = {}) {
  const dir = join(ENTREGA, slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, filename), buffer)
  return { filename, ...meta }
}

async function getProductImages(supabase, slug) {
  const { data: product } = await supabase.from('products').select('id, name, slug').eq('slug', slug).maybeSingle()
  if (!product) return null
  const { data: images } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', product.id)
    .order('display_order')
  return { ...product, images: images ?? [] }
}

async function processShorts(supabase) {
  for (const slug of DRAFT_SLUGS.shorts) {
    const product = await getProductImages(supabase, slug)
    if (!product) continue
    const entry = { slug, name: product.name, files: [] }

    // Manter fotos de modelo (primeiras 3, excluir closeup se nome/arquivo for o 4º)
    const modelImages = product.images.slice(0, 3)
    for (let i = 0; i < modelImages.length; i++) {
      const buf = await downloadUrl(modelImages[i].url)
      const fixed = await fixProporcaoModelo(buf)
      entry.files.push(await saveEntrega(slug, `0${i + 1}-modelo.jpg`, fixed, { tipo: 'modelo' }))
    }

  // Close-up: usuário enviará depois — pasta com LEIA-ME
    writeFileSync(
      join(ENTREGA, slug, 'LEIA-ME.txt'),
      'Adicione manualmente: 04-closeup.jpg (foto de detalhe do short que você vai enviar)',
    )

    manifest.products.push(entry)
    console.log(`OK shorts ${slug} (${entry.files.length} modelos)`)
  }
}

async function processOculos(supabase) {
  for (const slug of DRAFT_SLUGS.oculos) {
    const product = await getProductImages(supabase, slug)
    if (!product) continue
    const entry = { slug, name: product.name, files: [] }

    // Modelos (primeiras 1-2 fotos com pessoa)
    const modelCount = Math.min(2, product.images.length)
    for (let i = 0; i < modelCount; i++) {
      const buf = await downloadUrl(product.images[i].url)
      const fixed = await fixProporcaoModelo(buf)
      entry.files.push(await saveEntrega(slug, `0${i + 1}-modelo.jpg`, fixed, { tipo: 'modelo' }))
    }

    // Fotos de produto corretas (refs)
    const refs = OCULOS_PRODUCT_REFS[slug] ?? []
    for (let i = 0; i < refs.length; i++) {
      const refPath = join(OCULOS_DIR, refs[i])
      if (!existsSync(refPath)) continue
      const buf = await sharp(refPath)
        .resize(1200, 1500, { fit: 'inside' })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer()
      entry.files.push(
        await saveEntrega(slug, `0${modelCount + i + 1}-produto.jpg`, buf, { tipo: 'produto', ref: refs[i] }),
      )
    }

    manifest.products.push(entry)
    console.log(`OK oculos ${slug}`)
  }
}

async function processAdidas(supabase) {
  const logoPath = join(SOURCES, 'adidas-preta-logo.jpg')
  if (!existsSync(logoPath)) throw new Error(`Logo Adidas não encontrado: ${logoPath}`)

  // Neon — manter 1 e 2, corrigir só a 3
  const neon = await getProductImages(supabase, 'adidas-neon-amarela')
  if (neon?.images.length) {
    const entry = { slug: neon.slug, name: neon.name, files: [] }
    for (let i = 0; i < neon.images.length; i++) {
      const buf = await downloadUrl(neon.images[i].url)
      const out = i === neon.images.length - 1 ? await fixNeonBraco(buf) : await fixProporcaoModelo(buf)
      entry.files.push(
        await saveEntrega(neon.slug, `0${i + 1}-${i === neon.images.length - 1 ? 'corrigida' : 'manter'}.jpg`, out),
      )
    }
    manifest.products.push(entry)
    console.log('OK adidas neon')
  }

  // Preta — fotos de modelo com logo no peito
  const preta = await getProductImages(supabase, 'adidas-preta-logo-manga')
  if (preta?.images.length) {
    const entry = { slug: preta.slug, name: preta.name, files: [] }
    // Usar fotos que parecem modelo (não só produto flat) — todas com logo composto
    for (let i = 0; i < preta.images.length; i++) {
      const buf = await downloadUrl(preta.images[i].url)
      const withLogo = await compositeAdidasLogo(buf, logoPath)
      entry.files.push(await saveEntrega(preta.slug, `0${i + 1}-modelo-logo.jpg`, withLogo))
    }
    manifest.products.push(entry)
    console.log('OK adidas preta')
  }
}

async function processOn() {
  for (const [slug, prefixes] of Object.entries(ON_PHOTOS)) {
    const entry = { slug, files: [] }
    const tipos = ['frente', 'costas', 'detalhe']

    for (let i = 0; i < prefixes.length; i++) {
      const src = findSourceFile(ON_DIR, prefixes[i])
      if (!src) {
        console.warn(`AVISO: falta ${prefixes[i]} em sources/on/`)
        continue
      }
      let buf = readFileSync(src)
      buf = await fixProporcaoModelo(buf)
      if (slug === 'camisa-on-verde-claro' && tipos[i] === 'frente') {
        buf = await sharp(buf).modulate({ saturation: 1.2 }).jpeg({ quality: JPEG_QUALITY }).toBuffer()
      }
      entry.files.push(await saveEntrega(slug, `0${i + 1}-${tipos[i]}.jpg`, buf))
    }
    manifest.products.push(entry)
    console.log(`OK on ${slug} (${entry.files.length} fotos)`)
  }
}

function generateIndex() {
  const sections = manifest.products
    .map((p) => {
      const imgs = (p.files ?? [])
        .map(
          (f) =>
            `<div class="card"><img src="${p.slug}/${f.filename}" alt=""/><p><strong>${f.filename}</strong></p></div>`,
        )
        .join('')
      return `<section><h2>${p.name ?? p.slug}</h2><p><code>${p.slug}</code></p><div class="grid">${imgs}</div></section>`
    })
    .join('')

  writeFileSync(
    join(ENTREGA, 'INDEX.html'),
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Entrega Fotos</title>
<style>body{font-family:system-ui;background:#111;color:#eee;padding:2rem;max-width:1200px;margin:0 auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.card{background:#222;border-radius:8px;padding:.5rem}
.card img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:4px}
section{margin-bottom:2rem;border-bottom:1px solid #333;padding-bottom:1.5rem}
code{background:#333;padding:2px 6px;border-radius:4px}</style></head><body>
<h1>Entrega — Fotos para upload manual</h1>
<p>Gerado em ${manifest.generatedAt}. <strong>Não foi feito upload no Supabase.</strong></p>
${sections}
</body></html>`,
  )
  writeFileSync(join(ENTREGA, 'manifest.json'), JSON.stringify(manifest, null, 2))
}

async function main() {
  mkdirSync(ENTREGA, { recursive: true })
  const supabase = getSupabase()

  console.log('=== GERANDO ENTREGA (sem Supabase upload) ===\n')

  await processShorts(supabase)
  await processOculos(supabase)
  await processAdidas(supabase)
  await processOn()
  generateIndex()

  console.log(`\nEntrega em: ${ENTREGA}`)
  console.log(`Abra: ${join(ENTREGA, 'INDEX.html')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
