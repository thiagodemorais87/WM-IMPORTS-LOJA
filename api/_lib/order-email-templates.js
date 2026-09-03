const STATUS_LABELS = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  preparing: 'Em preparação',
  shipped: 'Enviado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function itemsRows(items) {
  return (items ?? [])
    .map((item) => {
      const size = item.variation_name ? escapeHtml(item.variation_name) : '—'
      return `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.product_name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${size}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.total_price)}</td>
      </tr>`
    })
    .join('')
}

function layout({ title, intro, order, extraHtml = '' }) {
  const orderNumber = escapeHtml(order.order_number)
  const customerName = escapeHtml(order.customer_name)
  const statusLabel = escapeHtml(STATUS_LABELS[order.status] || order.status)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">WM Imports</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(title)}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#3f3f46;">${intro}</p>

            <p style="margin:0 0 6px;font-size:14px;"><strong>Pedido:</strong> ${orderNumber}</p>
            <p style="margin:0 0 6px;font-size:14px;"><strong>Cliente:</strong> ${customerName}</p>
            <p style="margin:0 0 20px;font-size:14px;"><strong>Status:</strong> ${statusLabel}</p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;border-collapse:collapse;">
              <thead>
                <tr>
                  <th align="left" style="padding:8px 0;border-bottom:2px solid #e4e4e7;">Produto</th>
                  <th align="left" style="padding:8px 0;border-bottom:2px solid #e4e4e7;">Variação</th>
                  <th align="center" style="padding:8px 0;border-bottom:2px solid #e4e4e7;">Qtd</th>
                  <th align="right" style="padding:8px 0;border-bottom:2px solid #e4e4e7;">Unitário</th>
                  <th align="right" style="padding:8px 0;border-bottom:2px solid #e4e4e7;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows(order.items)}
              </tbody>
            </table>

            <p style="margin:20px 0 0;font-size:16px;"><strong>Total: ${formatCurrency(order.total_amount)}</strong></p>
            ${extraHtml}
            <p style="margin:28px 0 0;font-size:12px;color:#a1a1aa;">WM Imports — Sertânia/PE</p>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildOrderEmail(emailType, order) {
  const n = order.order_number

  switch (emailType) {
    case 'order_received':
      return {
        subject: `Pedido #${n} recebido - WM Imports`,
        html: layout({
          title: `Pedido #${n} recebido`,
          intro:
            'Recebemos o seu pedido. Ele está <strong>aguardando pagamento</strong> e será confirmado pelo WhatsApp com a loja.',
          order: { ...order, status: 'pending_payment' },
          extraHtml:
            '<p style="margin:16px 0 0;font-size:14px;color:#3f3f46;">Continue o atendimento pelo WhatsApp para combinar pagamento e entrega.</p>',
        }),
      }
    case 'payment_confirmed':
      return {
        subject: `Pagamento confirmado - Pedido #${n}`,
        html: layout({
          title: `Pagamento confirmado`,
          intro: 'Confirmamos o pagamento do seu pedido. Em breve iniciaremos a preparação.',
          order: { ...order, status: 'paid' },
        }),
      }
    case 'order_shipped':
      return {
        subject: `Seu pedido #${n} foi enviado`,
        html: layout({
          title: `Pedido enviado`,
          intro: 'Seu pedido foi enviado. Qualquer dúvida, fale conosco pelo WhatsApp.',
          order: { ...order, status: 'shipped' },
        }),
      }
    case 'order_completed':
      return {
        subject: `Pedido #${n} concluído`,
        html: layout({
          title: `Pedido concluído`,
          intro: 'Seu pedido foi concluído. Obrigado por comprar na WM Imports!',
          order: { ...order, status: 'completed' },
        }),
      }
    default:
      throw new Error(`Tipo de e-mail inválido: ${emailType}`)
  }
}
