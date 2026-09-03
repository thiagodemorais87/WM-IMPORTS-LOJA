import { supabase } from '@/lib/supabase'
import type { OrderEmailType } from '@/types'

async function getAdminAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Dispara e-mail via API server-side. Nunca relança erro — o pedido não depende disso.
 */
export async function queueOrderEmail(orderId: string, emailType: OrderEmailType) {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (emailType !== 'order_received') {
      const token = await getAdminAccessToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
    }

    await fetch('/api/orders/email', {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId, emailType }),
    })
  } catch (error) {
    console.error('[order-email]', error)
  }
}

export function queueOrderReceivedEmail(orderId: string) {
  return queueOrderEmail(orderId, 'order_received')
}

export function queueOrderPaidEmail(orderId: string) {
  return queueOrderEmail(orderId, 'payment_confirmed')
}

export function queueOrderShippedEmail(orderId: string) {
  return queueOrderEmail(orderId, 'order_shipped')
}

export function queueOrderCompletedEmail(orderId: string) {
  return queueOrderEmail(orderId, 'order_completed')
}
