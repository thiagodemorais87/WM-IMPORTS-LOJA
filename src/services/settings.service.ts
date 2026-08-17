import { supabase } from '@/lib/supabase'
import type { StoreSettings } from '@/types'

export async function getStoreSettings() {
  const { data, error } = await supabase.from('store_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data as StoreSettings | null
}

export async function updateStoreSettings(payload: Partial<StoreSettings>) {
  const { data, error } = await supabase.from('store_settings').update(payload).eq('id', 1).select('*').single()
  if (error) throw error
  return data as StoreSettings
}
