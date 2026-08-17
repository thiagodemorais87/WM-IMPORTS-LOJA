import { supabase } from '@/lib/supabase'
import type { DashboardStats, ProductWithRelations } from '@/types'
import { listAdminProducts } from '@/services/products.service'
import { getStoreSettings } from '@/services/settings.service'
import { totalStock } from '@/lib/stock'
import { subDays, format } from 'date-fns'

export async function getDashboardStats(): Promise<DashboardStats> {
  const [products, settings, salesResult, itemsResult] = await Promise.all([
    listAdminProducts(),
    getStoreSettings(),
    supabase.from('sales').select('id, total, sold_at').order('sold_at', { ascending: false }),
    supabase.from('sale_items').select('product_name, quantity'),
  ])

  if (salesResult.error) throw salesResult.error
  if (itemsResult.error) throw itemsResult.error

  const threshold = settings?.low_stock_threshold ?? 3
  const active = products.filter((product) => product.status === 'active')
  const units = products.reduce((sum, product) => sum + totalStock(product.variants), 0)
  const outOfStock = products.filter((product) => totalStock(product.variants) === 0).length
  const lowStock = products.filter((product) => {
    const qty = totalStock(product.variants)
    return qty > 0 && qty <= threshold
  }).length

  const sales = salesResult.data ?? []
  const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0)

  const topMap = new Map<string, number>()
  for (const item of itemsResult.data ?? []) {
    topMap.set(item.product_name, (topMap.get(item.product_name) ?? 0) + item.quantity)
  }
  const topProducts = [...topMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }))

  const days = Array.from({ length: 14 }, (_, index) => format(subDays(new Date(), 13 - index), 'yyyy-MM-dd'))
  const salesByDay = days.map((date) => {
    const daySales = sales.filter((sale) => sale.sold_at.slice(0, 10) === date)
    return {
      date,
      count: daySales.length,
      total: daySales.reduce((sum, sale) => sum + Number(sale.total), 0),
    }
  })

  return {
    totalProducts: products.length,
    activeProducts: active.length,
    outOfStock,
    lowStock,
    totalUnits: units,
    salesCount: sales.length,
    salesTotal,
    topProducts,
    salesByDay,
  }
}

export function lowStockProducts(products: ProductWithRelations[], threshold: number) {
  return products.filter((product) => {
    const qty = totalStock(product.variants)
    return qty > 0 && qty <= threshold
  })
}
