import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { useCart } from '@/contexts/CartContext'
import { useSettings } from '@/contexts/SettingsContext'
import { checkoutFormSchema, type CheckoutFormValues } from '@/lib/order-validation'
import { formatCurrency } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase'
import { buildWhatsAppLink, orderConfirmationMessage } from '@/lib/whatsapp'
import { createOrder } from '@/services/orders.service'
import { queueOrderReceivedEmail } from '@/lib/order-email'
import type { CreateOrderResult } from '@/types'

const emptyForm: CheckoutFormValues = {
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  notes: '',
}

export function CheckoutPage() {
  const { items, count, clear } = useCart()
  const settings = useSettings()
  const [form, setForm] = useState<CheckoutFormValues>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof CheckoutFormValues, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<CreateOrderResult | null>(null)
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  const estimatedTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  if (count === 0 && !success) {
    return <Navigate to="/carrinho" replace />
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting || items.length === 0) return

    const parsed = checkoutFormSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof CheckoutFormValues, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !fieldErrors[field as keyof CheckoutFormValues]) {
          fieldErrors[field as keyof CheckoutFormValues] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      const order = await createOrder({
        customer_name: parsed.data.customer_name,
        customer_phone: parsed.data.customer_phone,
        customer_email: parsed.data.customer_email,
        notes: parsed.data.notes,
        items: items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
      })

      const message = orderConfirmationMessage(
        settings,
        order,
        parsed.data.customer_name,
        order.items,
        parsed.data.notes,
      )
      const href = buildWhatsAppLink(settings?.whatsapp, message)

      clear()
      setSuccess(order)
      setWhatsappHref(href)
      setConfirmationEmail(parsed.data.customer_email)
      void queueOrderReceivedEmail(order.id)

      if (href) {
        const opened = window.open(href, '_blank', 'noopener,noreferrer')
        if (!opened) {
          toast.message('Pedido criado! Toque em "Abrir WhatsApp" para enviar a mensagem.')
        }
      } else {
        toast.error('Pedido criado, mas o WhatsApp da loja não está configurado.')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Seo title="Pedido realizado" path="/checkout" robots="noindex, nofollow" />
        <h1 className="font-display text-4xl">Pedido realizado</h1>
        <p className="mt-2 text-sm text-metal-400">
          Seu pedido <span className="text-white">{success.order_number}</span> foi registrado com sucesso.
        </p>

        <ul className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-panel p-6 text-sm text-metal-300">
          <li>
            <strong className="text-white">1. Envie a mensagem no WhatsApp</strong> — use o botão abaixo para a loja
            receber os dados do pedido.
          </li>
          <li>
            <strong className="text-white">2. Não precisa responder</strong> à conversa; em breve nossa equipe entrará
            em contato com você.
          </li>
          {confirmationEmail ? (
            <li>
              <strong className="text-white">3. Confirmação por e-mail</strong> — enviamos um resumo para{' '}
              <span className="text-white">{confirmationEmail}</span>.
            </li>
          ) : null}
        </ul>

        <div className="mt-6 rounded-2xl border border-white/10 bg-panel p-6">
          <p className="text-sm text-metal-400">Total do pedido</p>
          <p className="mt-1 text-2xl text-white">{formatCurrency(success.total_amount)}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {whatsappHref ? (
              <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex-1">
                <Button variant="whatsapp" className="w-full">
                  Abrir WhatsApp
                </Button>
              </a>
            ) : (
              <Button variant="whatsapp" disabled className="flex-1">
                WhatsApp não configurado
              </Button>
            )}
            <Link to="/produtos" className="flex-1">
              <Button variant="ghost" className="w-full">
                Continuar comprando
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Seo title="Checkout" path="/checkout" robots="noindex, nofollow" />
      <h1 className="font-display text-4xl">Finalizar pedido</h1>
      <p className="mt-2 text-sm text-metal-400">
        Preencha seus dados para registrar o pedido. Não há pagamento online — você será direcionado ao WhatsApp para
        confirmar pagamento e disponibilidade.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <form className="space-y-4 rounded-2xl border border-white/10 bg-panel p-6" onSubmit={handleSubmit}>
          <Field label="Nome completo">
            <Input
              value={form.customer_name}
              onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))}
              autoComplete="name"
              required
            />
            {errors.customer_name ? <span className="text-xs text-red-300">{errors.customer_name}</span> : null}
          </Field>

          <Field label="WhatsApp">
            <Input
              value={form.customer_phone}
              onChange={(event) => setForm((current) => ({ ...current, customer_phone: event.target.value }))}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(87) 99999-9999"
              required
            />
            {errors.customer_phone ? <span className="text-xs text-red-300">{errors.customer_phone}</span> : null}
          </Field>

          <Field label="E-mail">
            <Input
              type="email"
              value={form.customer_email}
              onChange={(event) => setForm((current) => ({ ...current, customer_email: event.target.value }))}
              autoComplete="email"
              required
            />
            {errors.customer_email ? <span className="text-xs text-red-300">{errors.customer_email}</span> : null}
          </Field>

          <Field label="Observação (opcional)">
            <Textarea
              value={form.notes ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Horário preferido, referência de entrega, etc."
            />
            {errors.notes ? <span className="text-xs text-red-300">{errors.notes}</span> : null}
          </Field>

          {!isSupabaseConfigured ? (
            <p className="text-sm text-amber-300">Serviço temporariamente indisponível. Tente novamente mais tarde.</p>
          ) : null}

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="submit"
              variant="whatsapp"
              className="flex-1"
              disabled={submitting || !isSupabaseConfigured}
            >
              {submitting ? 'Registrando pedido…' : 'Finalizar pedido'}
            </Button>
            <Link to="/carrinho" className="flex-1">
              <Button type="button" variant="ghost" className="w-full">
                Voltar ao carrinho
              </Button>
            </Link>
          </div>
        </form>

        <aside className="h-fit rounded-2xl border border-white/10 bg-panel p-6">
          <h2 className="font-medium text-white">Resumo</h2>
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.variantId} className="text-sm">
                <p className="text-white">{item.name}</p>
                <p className="text-metal-400">
                  {item.sizeLabel} · {item.quantity} un · {formatCurrency(item.unitPrice * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-sm text-metal-400">Estimativa</span>
            <span className="text-lg text-white">{formatCurrency(estimatedTotal)}</span>
          </div>
          <p className="mt-2 text-xs text-metal-500">
            O valor final será confirmado pelo servidor ao registrar o pedido.
          </p>
        </aside>
      </div>
    </div>
  )
}
