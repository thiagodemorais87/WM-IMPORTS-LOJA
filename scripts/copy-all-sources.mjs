import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const ASSETS = join(
  homedir(),
  '.cursor/projects/c-Users-Rog-rio-Documents-Projetos-dev-PESSOAL-WM-IMPORTS-LOJA/assets',
)
const ROOT = resolve('scripts/assets/photo-update/sources')
const PREFIX = /^c__Users_Rog_rio_AppData_Roaming_Cursor_User_workspaceStorage_c839b95d2b9387eccbcf22476c579409_images_/

const DIRS = {
  on: join(ROOT, 'on'),
  oculos: join(ROOT, 'oculos-referencia'),
  shorts: join(ROOT, 'shorts'),
  adidas: join(ROOT, 'adidas'),
}

for (const d of Object.values(DIRS)) mkdirSync(d, { recursive: true })

const files = readdirSync(ASSETS)
const manifest = { on: [], oculos: [], shorts: [], adidas: [], other: [] }

for (const f of files) {
  if (!/\.(jpe?g|png|webp)$/i.test(f)) continue
  const src = join(ASSETS, f)

  if (f.includes('camiseta-')) {
    const name = f.replace(PREFIX, '')
    copyFileSync(src, join(DIRS.on, name))
    manifest.on.push(name)
  } else if (f.includes('shorts-treino-')) {
    const name = f.replace(PREFIX, '')
    copyFileSync(src, join(DIRS.shorts, name))
    manifest.shorts.push(name)
  } else if (f.includes('adidas-') && f.includes('frente-corrigida')) {
    const name = f.replace(PREFIX, '')
    copyFileSync(src, join(DIRS.adidas, name))
    manifest.adidas.push(name)
  } else if (f.includes('WhatsApp') && (f.includes('13.05') || f.includes('13.25'))) {
    const short = f.slice(-40)
    copyFileSync(src, join(DIRS.oculos, short))
    manifest.oculos.push(short)
  }
}

for (const name of ['shorts-trydfit-ref.jpg', 'adidas-preta-logo.jpg']) {
  const p = join(ROOT, name)
  if (existsSync(p)) manifest.other.push(name)
}

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('ON:', manifest.on.length)
console.log('SHORTS:', manifest.shorts.length)
console.log('ADIDAS:', manifest.adidas.length)
console.log('OCULOS:', manifest.oculos.length)
