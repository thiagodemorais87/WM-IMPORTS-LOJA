import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

export const BUCKET = 'product-images'
export const MAX_EDGE = 1600
export const JPEG_QUALITY = 82
export const SOURCES = resolve('scripts/assets/photo-update/sources')
export const PREVIEWS = resolve('scripts/assets/photo-update/previews')

export function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const path = resolve(process.cwd(), f)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

export function getSupabase() {
  loadEnv()
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Defina VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function downloadUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

export const SHORTS_CROPS = {
  'short-trydfit-preto': { left: 0, top: 55, width: 210, height: 210 },
  'short-trydfit-creme': { left: 45, top: 145, width: 210, height: 210 },
  'short-trydfit-caqui': { left: 85, top: 270, width: 220, height: 220 },
  'marrom-trydfit': { left: 85, top: 270, width: 220, height: 220, saturation: 0.85, hue: 15 },
  'short-trydfit-azul': { left: 130, top: 400, width: 220, height: 220 },
  'short-trydfit-verde': { left: 175, top: 560, width: 240, height: 240 },
}

export const SHORTS_CLOSEUPS = {
  'short-trydfit-preto': 'shorts-treino-preto-detalhe',
  'short-trydfit-creme': 'shorts-treino-creme-detalhe',
  'short-trydfit-caqui': 'shorts-treino-bege-detalhe',
  'short-trydfit-azul': 'shorts-treino-azul-marinho-detalhe',
  'short-trydfit-verde': 'shorts-treino-verde-agua-detalhe',
  'marrom-trydfit': 'shorts-treino-marrom-detalhe',
}

export const ADIDAS_PRIMARY = {
  'adidas-preta-logo-manga': 'adidas-preta-frente-corrigida',
  'adidas-neon-amarela': 'adidas-verde-neon-frente-corrigida',
}

export function findSourceFile(dir, prefix) {
  if (!existsSync(dir)) return null
  const match = readdirSync(dir).find((f) => f.startsWith(prefix))
  return match ? join(dir, match) : null
}

export const ON_PHOTOS = {
  'camisa-on-branca': ['camiseta-branca-frente', 'camiseta-branca-costas', 'camiseta-branca-detalhe'],
  'camisa-on-preta-2': ['camiseta-preta-frente', 'camiseta-preta-costas', 'camiseta-preta-detalhe'],
  'camisa-on-cinza': ['camiseta-cinza-escuro-frente', 'camiseta-cinza-escuro-costas', 'camiseta-cinza-escuro-detalhe'],
  'camisa-on-verde-claro': ['camiseta-verde-claro-frente', 'camiseta-verde-claro-costas', 'camiseta-verde-claro-detalhe'],
  'camisa-on-azul-claro': ['camiseta-azul-claro-frente', 'camiseta-azul-claro-costas', 'camiseta-azul-claro-detalhe'],
}

/** Melhor foto de produto por slug (refs validadas visualmente) */
export const OCULOS_PRODUCT_REFS = {
  'fumaca-retangular': [
    'f89b3efb-9ea0-455e-9b53-d1972cf30c3b.jpg',
    'cef5f77c-1c35-4ba4-9212-c791ae011a0c.jpg',
  ],
  'cristal-redondo': [
    '765204b3-f17d-4e6f-a22c-1acd6d51b2f9.jpg',
    'e5ebb731-3756-400a-b72e-63003033ccd9.jpg',
  ],
  'creme-translucido': [
    '3c81ff36-397c-4ee7-84db-5a8cda4d9938.jpg',
    '9c035c06-2dbc-4e4d-8e86-e21b053be6d7.jpg',
  ],
}

export const DRAFT_SLUGS = {
  shorts: Object.keys(SHORTS_CROPS),
  oculos: Object.keys(OCULOS_PRODUCT_REFS),
  adidas: ['adidas-neon-amarela', 'adidas-preta-logo-manga'],
  on: Object.keys(ON_PHOTOS),
}
