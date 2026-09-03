import { supabase } from '@/lib/supabase'
import type {
  CreateOrderInput,
  CreateOrderResult,
  OrderItem,
  OrderStatus,
  OrderWithItems,
  PaymentMethod,
  UpdateOrderInput,
} from '@/types'

function mapOrderError(message: string): string {
  if (message.includes('Estoque insuficiente')) {
    return message.replace(/^.*Estoque insuficiente/, 'Estoque insuficiente')
  }
  if (message.includes('Variante indisponível') || message.includes('Produto indisponível')) {
    return `${message}. Atualize os itens e tente novamente.`
  }
  if (message.includes('Variante não encontrada') || message.includes('Produto não encontrado')) {
    return 'Um item não está mais disponível. Atualize o pedido e tente novamente.'
  }
  if (message.includes('Transição inválida')) {
    return message
  }
  return message
}

function parseOrderRow(order: Record<string, unknown>, items: OrderItem[] = []): OrderWithItems {
  return {
    id: String(order.id),
    order_number: String(order.order_number),
    customer_name: String(order.customer_name),
    customer_phone: String(order.customer_phone),
    customer_email: String(order.customer_email),
    notes: order.notes ? String(order.notes) : null,
    status: order.status as OrderWithItems['status'],
    payment_method: (order.payment_method as PaymentMethod | null) ?? null,
    sale_id: order.sale_id ? String(order.sale_id) : null,
    discount_amount: Number(order.discount_amount ?? 0),
    total_amount: Number(order.total_amount),
    created_at: String(order.created_at),
    updated_at: String(order.updated_at),
    paid_at: order.paid_at ? String(order.paid_at) : null,
    items: items.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
      total_price: Number(item.total_price),
    })),
  }
}

function parseOrderItems(rawItems: Array<Record<string, unknown>>): OrderItem[] {
  return rawItems.map((item) => ({
    id: item.id ? String(item.id) : undefined,
    order_id: item.order_id ? String(item.order_id) : undefined,
    product_id: String(item.product_id),
    product_name: String(item.product_name),
    variation_id: item.variation_id ? String(item.variation_id) : null,
    variation_name: item.variation_name ? String(item.variation_name) : null,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: Number(item.total_price),
  }))
}

function parseOrderResult(data: unknown): CreateOrderResult {
  const raw = data as {
    id: string
    order_number: string
    total_amount: number | string
    items: Array<{
      product_id: string
      product_name: string
      variation_id: string | null
      variation_name: string | null
      quantity: number
      unit_price: number | string
      total_price: number | string
    }>
  }

  return {
    id: raw.id,
    order_number: raw.order_number,
    total_amount: Number(raw.total_amount),
    items: (raw.items ?? []).map(
      (item): OrderItem => ({
        product_id: item.product_id,
        product_name: item.product_name,
        variation_id: item.variation_id,
        variation_name: item.variation_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
      }),
    ),
  }
}

export async function createOrder(payload: CreateOrderInput): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: payload.customer_name,
    p_customer_phone: payload.customer_phone,
    p_customer_email: payload.customer_email,
    p_notes: payload.notes?.trim() || null,
    p_items: payload.items.map((item) => ({
      variant_id: item.variant_id,
      quantity: item.quantity,
    })),
  })

  if (error) {
    throw new Error(mapOrderError(error.message))
  }

  if (!data) {
    throw new Error('Não foi possível criar o pedido. Tente novamente.')
  }

  return parseOrderResult(data)
}

export async function listOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(mapOrderError(error.message))

  return (data ?? []).map((order) =>
    parseOrderRow(order, parseOrderItems((order.items ?? []) as Array<Record<string, unknown>>)),
  )
}

export async function getOrder(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(mapOrderError(error.message))
  if (!data) throw new Error('Pedido não encontrado')

  return parseOrderRow(data, parseOrderItems((data.items ?? []) as Array<Record<string, unknown>>))
}

export async function confirmOrderPayment(orderId: string, paymentMethod: PaymentMethod) {
  const { data, error } = await supabase.rpc('confirm_order_payment', {
    p_order_id: orderId,
    p_payment_method: paymentMethod,
  })

  if (error) throw new Error(mapOrderError(error.message))
  if (!data) throw new Error('Não foi possível confirmar o pagamento.')

  return data as { order_id: string; sale_id: string; order_number: string }
}

export async function updateOrder(orderId: string, payload: UpdateOrderInput) {
  const { data, error } = await supabase.rpc('update_order', {
    p_order_id: orderId,
    p_customer_name: payload.customer_name,
    p_customer_phone: payload.customer_phone,
    p_customer_email: payload.customer_email,
    p_notes: payload.notes?.trim() || null,
    p_discount_amount: payload.discount_amount,
    p_items: payload.items.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    })),
  })

  if (error) throw new Error(mapOrderError(error.message))
  if (!data) throw new Error('Não foi possível atualizar o pedido.')

  return data as {
    order_id: string
    order_number: string
    total_amount: number
    subtotal: number
    discount_amount: number
  }
}

export async function cancelOrder(orderId: string) {
  const { data, error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
  })

  if (error) throw new Error(mapOrderError(error.message))
  if (!data) throw new Error('Não foi possível cancelar o pedido.')

  return data as { order_id: string; order_number: string; status: OrderStatus }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const { data, error } = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_status: status,
  })

  if (error) throw new Error(mapOrderError(error.message))
  if (!data) throw new Error('Não foi possível atualizar o status.')

  return data as { order_id: string; order_number: string; status: OrderStatus }
}

export async function listOrderEvents(orderId: string) {
  const { data, error } = await supabase
    .from('order_events')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((event) => ({
    id: String(event.id),
    order_id: String(event.order_id),
    event_type: event.event_type,
    message: String(event.message),
    metadata: (event.metadata as Record<string, unknown> | null) ?? null,
    user_id: event.user_id ? String(event.user_id) : null,
    created_at: String(event.created_at),
  }))
}

export async function listOrderEmailLogs(orderId: string) {
  const { data, error } = await supabase
    .from('email_logs')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((log) => ({
    id: String(log.id),
    order_id: String(log.order_id),
    customer_email: String(log.customer_email),
    email_type: String(log.email_type),
    status: String(log.status),
    provider_id: log.provider_id ? String(log.provider_id) : null,
    error_message: log.error_message ? String(log.error_message) : null,
    created_at: String(log.created_at),
  }))
}
