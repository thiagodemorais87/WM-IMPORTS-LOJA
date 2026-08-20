import { supabase } from '@/lib/supabase'
import type { Banner } from '@/types'

/** Banner padrão = o mais antigo (seed); empate por menor display_order. */
export function getDefaultBannerId(all: Banner[]) {
  if (!all.length) return null
  const sorted = [...all].sort((a, b) => {
    const byCreated = a.created_at.localeCompare(b.created_at)
    if (byCreated !== 0) return byCreated
    return a.display_order - b.display_order
  })
  return sorted[0]?.id ?? null
}

export function isDefaultBanner(banner: Banner, all: Banner[]) {
  return banner.id === getDefaultBannerId(all)
}

export async function listPublicBanners() {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('active', true)
    .order('display_order')
  if (error) throw error

  const active = (data ?? []) as Banner[]
  if (active.length) return active

  // Se nenhum ativo (ex.: sessão admin vê inativos via RLS), usa o padrão
  const { data: visible, error: visibleError } = await supabase.from('banners').select('*').order('display_order')
  if (visibleError) throw visibleError
  const list = (visible ?? []) as Banner[]
  if (!list.length) return []
  const defaultId = getDefaultBannerId(list)
  const fallback = list.find((banner) => banner.id === defaultId)
  return fallback ? [fallback] : []
}

export async function listAdminBanners() {
  const { data, error } = await supabase.from('banners').select('*').order('display_order')
  if (error) throw error
  return (data ?? []) as Banner[]
}

export async function createBanner(payload: Partial<Banner>) {
  const { data, error } = await supabase.from('banners').insert(payload).select('*').single()
  if (error) throw error
  return data as Banner
}

export async function updateBanner(id: string, payload: Partial<Banner>, all?: Banner[]) {
  if (payload.active === false) {
    const banners = all ?? (await listAdminBanners())
    if (getDefaultBannerId(banners) === id) {
      throw new Error('O banner padrão não pode ser desativado.')
    }
  }

  const { data, error } = await supabase.from('banners').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data as Banner
}

export async function updateBannerOrder(idsOrdered: string[]) {
  const results = await Promise.all(
    idsOrdered.map((id, index) => supabase.from('banners').update({ display_order: index + 1 }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function deleteBanner(id: string, all: Banner[]) {
  if (getDefaultBannerId(all) === id) {
    throw new Error('O banner padrão não pode ser excluído.')
  }
  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) throw error
}

/** Garante que o banner padrão fique ativo (útil se já estava inativo no banco). */
export async function ensureDefaultBannerActive(all: Banner[]) {
  const defaultId = getDefaultBannerId(all)
  if (!defaultId) return
  const current = all.find((banner) => banner.id === defaultId)
  if (current && !current.active) {
    const { error } = await supabase.from('banners').update({ active: true }).eq('id', defaultId)
    if (error) throw error
  }
}
