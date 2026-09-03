import { supabase } from '@/lib/supabase'
import type { DashboardStats, ProductWithRelations } from '@/types'
import { getStoreSettings } from '@/services/settings.service'
import { totalStock } from '@/lib/stock'
import { subDays, format } from 'date-fns'

const VALID_REVENUE_STATUSES = ['paid', 'preparing', 'shipped', 'completed'] as const
const BRAZIL_TZ = 'America/Sao_Paulo'

function brazilDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BRAZIL_TZ }).format(date)
}

function brazilMonthKey(date: Date): string {
  return brazilDateKey(date).slice(0, 7)
}

function orderReferenceDate(order: { paid_at: string | null; created_at: string }): string {
  return order.paid_at ?? order.created_at
}

function isValidRevenueOrder(status: string): boolean {
  return (VALID_REVENUE_STATUSES as readonly string[]).includes(status)
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [productsResult, settings, ordersResult, orderItemsResult] = await Promise.all([
    supabase.from('products').select('id, status, product_variants(quantity)'),
    getStoreSettings(),
    supabase
      .from('orders')
      .select('id, status, total_amount, paid_at, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('order_items').select('order_id, product_name, quantity'),
  ])

  if (productsResult.error) throw productsResult.error
  if (ordersResult.error) throw ordersResult.error
  if (orderItemsResult.error) throw orderItemsResult.error

  const products = productsResult.data ?? []
  const threshold = settings?.low_stock_threshold ?? 3
  const active = products.filter((product) => product.status === 'active')
  const units = products.reduce((sum, product) => sum + totalStock(product.product_variants ?? []), 0)
  const outOfStock = products.filter((product) => totalStock(product.product_variants ?? []) === 0).length
  const lowStock = products.filter((product) => {
    const qty = totalStock(product.product_variants ?? [])
    return qty > 0 && qty <= threshold
  }).length

  const orders = ordersResult.data ?? []
  const todayKey = brazilDateKey(new Date())
  const monthKey = brazilMonthKey(new Date())

  const pendingPaymentCount = orders.filter((order) => order.status === 'pending_payment').length

  const validOrders = orders.filter((order) => isValidRevenueOrder(order.status))
  const ordersToday = validOrders.filter(
    (order) => brazilDateKey(new Date(orderReferenceDate(order))) === todayKey,
  )
  const ordersMonth = validOrders.filter(
    (order) => brazilMonthKey(new Date(orderReferenceDate(order))) === monthKey,
  )

  const salesTodayCount = ordersToday.length
  const revenueToday = ordersToday.reduce((sum, order) => sum + Number(order.total_amount), 0)
  const salesMonthCount = ordersMonth.length
  const revenueMonth = ordersMonth.reduce((sum, order) => sum + Number(order.total_amount), 0)
  const averageTicket = salesMonthCount > 0 ? revenueMonth / salesMonthCount : 0

  const validOrderIds = new Set(validOrders.map((order) => order.id))
  const monthOrderIds = new Set(ordersMonth.map((order) => order.id))

  const topMap = new Map<string, number>()
  let productsSoldMonth = 0

  for (const item of orderItemsResult.data ?? []) {
    if (!validOrderIds.has(item.order_id)) continue
    topMap.set(item.product_name, (topMap.get(item.product_name) ?? 0) + item.quantity)
    if (monthOrderIds.has(item.order_id)) {
      productsSoldMonth += item.quantity
    }
  }

  const topProducts = [...topMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }))

  const days = Array.from({ length: 14 }, (_, index) => format(subDays(new Date(), 13 - index), 'yyyy-MM-dd'))
  const salesByDay = days.map((date) => {
    const dayOrders = validOrders.filter(
      (order) => brazilDateKey(new Date(orderReferenceDate(order))) === date,
    )
    return {
      date,
      count: dayOrders.length,
      total: dayOrders.reduce((sum, order) => sum + Number(order.total_amount), 0),
    }
  })

  return {
    totalProducts: products.length,
    activeProducts: active.length,
    outOfStock,
    lowStock,
    totalUnits: units,
    pendingPaymentCount,
    salesTodayCount,
    revenueToday,
    salesMonthCount,
    revenueMonth,
    averageTicket,
    productsSoldMonth,
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
