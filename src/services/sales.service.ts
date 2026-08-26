import { supabase } from '@/lib/supabase'
import type { PaymentMethod, SaleWithItems } from '@/types'

export interface SaleItemInput {
  variant_id: string
  quantity: number
  /** Opcional: preço negociado; exige discount_reason */
  manual_unit_price?: number
  discount_reason?: string
}

export async function registerSale(payload: {
  customer_name: string
  payment_method: PaymentMethod
  notes: string
  sold_at: string
  items: SaleItemInput[]
}) {
  const { data, error } = await supabase.rpc('register_sale', {
    p_customer_name: payload.customer_name || null,
    p_payment_method: payload.payment_method,
    p_notes: payload.notes || null,
    p_sold_at: payload.sold_at,
    p_items: payload.items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
      ...(item.manual_unit_price != null
        ? {
            manual_unit_price: item.manual_unit_price,
            discount_reason: item.discount_reason,
          }
        : {}),
    })),
  })
  if (error) throw error
  return data as string
}

export async function listSales() {
  const { data, error } = await supabase
    .from('sales')
    .select('*, items:sale_items(*)')
    .order('sold_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((sale) => ({
    ...sale,
    total: Number(sale.total),
    items: (sale.items ?? []).map((item: SaleWithItems['items'][number]) => ({
      ...item,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
    })),
  })) as SaleWithItems[]
}
