import { supabase } from '@/lib/supabase'
import type { Banner } from '@/types'

export async function listPublicBanners() {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return (data ?? []) as Banner[]
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

export async function updateBanner(id: string, payload: Partial<Banner>) {
  const { data, error } = await supabase.from('banners').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data as Banner
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) throw error
}
