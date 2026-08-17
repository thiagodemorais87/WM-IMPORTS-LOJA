import { supabase } from '@/lib/supabase'
import type { StockMovement, StockMovementType } from '@/types'

export async function adjustStock(payload: {
  variant_id: string
  type: Exclude<StockMovementType, 'venda'>
  quantity: number
  reason: string
}) {
  const { error } = await supabase.rpc('adjust_stock', {
    p_variant_id: payload.variant_id,
    p_type: payload.type,
    p_quantity: payload.quantity,
    p_reason: payload.reason || null,
  })
  if (error) throw error
}

export async function listStockMovements() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, product:products(id, name), variant:product_variants(id, size_label)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data ?? []) as StockMovement[]
}
