import { supabase } from '@/lib/supabase'
import type { StoreHighlight } from '@/types'

export async function listPublicHighlights() {
  const { data, error } = await supabase
    .from('store_highlights')
    .select('*')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return (data ?? []) as StoreHighlight[]
}

export async function listAdminHighlights() {
  const { data, error } = await supabase.from('store_highlights').select('*').order('display_order')
  if (error) throw error
  return (data ?? []) as StoreHighlight[]
}

export async function createHighlight(payload: Partial<StoreHighlight>) {
  const { data, error } = await supabase.from('store_highlights').insert(payload).select('*').single()
  if (error) throw error
  return data as StoreHighlight
}

export async function updateHighlight(id: string, payload: Partial<StoreHighlight>) {
  const { data, error } = await supabase.from('store_highlights').update(payload).eq('id', id).select('*').single()
  if (error) throw error
  return data as StoreHighlight
}

export async function deleteHighlight(id: string) {
  const { error } = await supabase.from('store_highlights').delete().eq('id', id)
  if (error) throw error
}
