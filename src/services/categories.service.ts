import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import type { Category } from '@/types'

export async function listPublicCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('display_order')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function listAdminCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('display_order')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function createCategory(payload: {
  name: string
  description: string
  active: boolean
  display_order: number
}) {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: payload.name,
      slug: slugify(payload.name),
      description: payload.description || null,
      active: payload.active,
      display_order: payload.display_order,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(
  id: string,
  payload: { name: string; description: string; active: boolean; display_order: number },
) {
  const { data, error } = await supabase
    .from('categories')
    .update({
      name: payload.name,
      slug: slugify(payload.name),
      description: payload.description || null,
      active: payload.active,
      display_order: payload.display_order,
    })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Category
}

export async function updateCategoryOrder(idsOrdered: string[]) {
  const results = await Promise.all(
    idsOrdered.map((id, index) => supabase.from('categories').update({ display_order: index + 1 }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
