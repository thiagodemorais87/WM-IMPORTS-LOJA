import { getSupabaseAdmin } from './supabase-admin.js'
import { isResendConfigured, sendEmail } from './resend-client.js'
import { buildOrderEmail, DEFAULT_LOGO_URL } from './order-email-templates.js'

export const EMAIL_TYPES = ['order_received', 'payment_confirmed', 'order_shipped', 'order_completed']

const ADMIN_EMAIL_TYPES = new Set(['payment_confirmed', 'order_shipped', 'order_completed'])
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  return email.length > 0 && email.length <= 254 && EMAIL_RE.test(email)
}

export function isAdminEmailType(emailType) {
  return ADMIN_EMAIL_TYPES.has(emailType)
}

function statusAllowsEmailType(status, emailType) {
  switch (emailType) {
    case 'order_received':
      return Boolean(status)
    case 'payment_confirmed':
      return ['paid', 'preparing', 'shipped', 'completed'].includes(status)
    case 'order_shipped':
      return ['shipped', 'completed'].includes(status)
    case 'order_completed':
      return status === 'completed'
    default:
      return false
  }
}

async function insertLog(admin, payload) {
  const { error } = await admin.from('email_logs').insert(payload)
  if (error) {
    console.error('[email_logs] insert error:', error.message)
  }
}

async function loadBranding(admin) {
  const { data } = await admin.from('store_settings').select('store_name, logo_url').eq('id', 1).maybeSingle()

  const logoUrl =
    process.env.EMAIL_LOGO_URL ||
    (data?.logo_url && String(data.logo_url).startsWith('http') ? data.logo_url : null) ||
    DEFAULT_LOGO_URL

  return {
    storeName: data?.store_name || 'WM Imports',
    logoUrl,
  }
}

/**
 * Envia e-mail de pedido. Nunca lança para desfazer o fluxo de negócio.
 */
export async function sendOrderEmail({ orderId, emailType }) {
  if (!EMAIL_TYPES.includes(emailType)) {
    return { ok: false, skipped: true, error: 'Tipo de e-mail inválido' }
  }

  if (!isResendConfigured()) {
    console.warn('[order-email] Resend não configurado — e-mail ignorado')
    return { ok: false, skipped: true, error: 'Resend não configurado' }
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    console.warn('[order-email] SUPABASE_SERVICE_ROLE_KEY ausente — e-mail ignorado')
    return { ok: false, skipped: true, error: 'Service role não configurado' }
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('*, items:order_items(*)')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order) {
    console.error('[order-email] pedido não encontrado:', orderError?.message)
    return { ok: false, skipped: true, error: 'Pedido não encontrado' }
  }

  if (!statusAllowsEmailType(order.status, emailType)) {
    return {
      ok: false,
      skipped: true,
      error: `Status ${order.status} incompatível com ${emailType}`,
    }
  }

  const { data: existingSent } = await admin
    .from('email_logs')
    .select('id')
    .eq('order_id', orderId)
    .eq('email_type', emailType)
    .eq('status', 'sent')
    .maybeSingle()

  if (existingSent) {
    return { ok: true, skipped: true, error: null }
  }

  if (!isValidEmail(order.customer_email)) {
    const message = 'E-mail do cliente inválido'
    await insertLog(admin, {
      order_id: orderId,
      customer_email: String(order.customer_email ?? ''),
      email_type: emailType,
      status: 'failed',
      error_message: message,
    })
    return { ok: false, skipped: false, error: message }
  }

  let subject
  let html
  try {
    const branding = await loadBranding(admin)
    const built = buildOrderEmail(
      emailType,
      {
        ...order,
        items: order.items ?? [],
      },
      branding,
    )
    subject = built.subject
    html = built.html
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await insertLog(admin, {
      order_id: orderId,
      customer_email: order.customer_email,
      email_type: emailType,
      status: 'failed',
      error_message: message,
    })
    return { ok: false, skipped: false, error: message }
  }

  const result = await sendEmail({
    to: order.customer_email,
    subject,
    html,
  })

  if (result.ok) {
    await insertLog(admin, {
      order_id: orderId,
      customer_email: order.customer_email,
      email_type: emailType,
      status: 'sent',
      provider_id: result.providerId,
    })
    const { error: eventError } = await admin.from('order_events').insert({
      order_id: orderId,
      event_type: 'email_sent',
      message: `E-mail ${emailType} enviado`,
      metadata: { email_type: emailType, provider_id: result.providerId },
    })
    if (eventError) {
      console.error('[order_events] insert error:', eventError.message)
    }
    return { ok: true, skipped: false, providerId: result.providerId }
  }

  if (result.skipped) {
    await insertLog(admin, {
      order_id: orderId,
      customer_email: order.customer_email,
      email_type: emailType,
      status: 'skipped',
      error_message: result.error,
    })
    return { ok: false, skipped: true, error: result.error }
  }

  await insertLog(admin, {
    order_id: orderId,
    customer_email: order.customer_email,
    email_type: emailType,
    status: 'failed',
    error_message: result.error,
  })

  console.error('[order-email] falha no envio:', result.error)
  return { ok: false, skipped: false, error: result.error }
}
