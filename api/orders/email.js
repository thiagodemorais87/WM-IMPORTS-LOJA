import { assertIsAdmin } from '../_lib/supabase-admin.js'
import { EMAIL_TYPES, isAdminEmailType, sendOrderEmail } from '../_lib/send-order-email.js'

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Método não permitido' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const orderId = body.orderId
    const emailType = body.emailType

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ ok: false, error: 'orderId obrigatório' })
    }

    if (!EMAIL_TYPES.includes(emailType)) {
      return res.status(400).json({ ok: false, error: 'emailType inválido' })
    }

    if (isAdminEmailType(emailType)) {
      const token = readBearerToken(req)
      const auth = await assertIsAdmin(token)
      if (!auth.ok) {
        return res.status(401).json({ ok: false, error: auth.error || 'Não autorizado' })
      }
    }

    const result = await sendOrderEmail({ orderId, emailType })

    // Sempre 200 para o cliente não tratar e-mail como falha do pedido.
    // skipped / failed ficam no body e em email_logs.
    return res.status(200).json({
      ok: result.ok,
      skipped: Boolean(result.skipped),
      error: result.error ?? null,
      providerId: result.providerId ?? null,
    })
  } catch (error) {
    console.error('[api/orders/email] unexpected:', error)
    return res.status(200).json({
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Erro ao processar e-mail',
    })
  }
}
