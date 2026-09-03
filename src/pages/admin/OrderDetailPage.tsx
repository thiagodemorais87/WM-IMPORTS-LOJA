import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { ErrorState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import {
  cancelOrder,
  confirmOrderPayment,
  getOrder,
  listOrderEmailLogs,
  listOrderEvents,
  updateOrder,
  updateOrderStatus,
} from '@/services/orders.service'
import { listAdminProducts } from '@/services/products.service'
import {
  queueOrderCompletedEmail,
  queueOrderPaidEmail,
  queueOrderShippedEmail,
} from '@/lib/order-email'
import { formatCurrency, formatDate } from '@/lib/format'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS, PAYMENT_LABELS } from '@/constants'
import {
  orderSubtotal,
  type OrderItemInput,
  type OrderEmailLog,
  type OrderEvent,
  type OrderStatus,
  type OrderWithItems,
  type PaymentMethod,
  type ProductWithRelations,
} from '@/types'

type EditableItem = {
  key: string
  id?: string
  productId: string
  variantId: string
  quantity: number
  unitPrice: number
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS_BADGE[status]
  return (
    <Badge tone={config.tone}>
      {config.emoji} {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}

function createEditableItem(product?: ProductWithRelations, variantId?: string): EditableItem {
  const variant = variantId
    ? product?.variants.find((item) => item.id === variantId)
    : product?.variants[0]

  return {
    key: crypto.randomUUID(),
    productId: product?.id ?? '',
    variantId: variant?.id ?? '',
    quantity: 1,
    unitPrice: product?.promotional_price && product.promotional_price < product.price
      ? product.promotional_price
      : product?.price ?? 0,
  }
}

function itemsToEditable(items: OrderWithItems['items']): EditableItem[] {
  return items.map((item) => ({
    key: item.id ?? crypto.randomUUID(),
    id: item.id,
    productId: item.product_id,
    variantId: item.variation_id ?? '',
    quantity: item.quantity,
    unitPrice: item.unit_price,
  }))
}

function nextStatus(status: OrderStatus): OrderStatus | null {
  if (status === 'paid') return 'preparing'
  if (status === 'preparing') return 'shipped'
  if (status === 'shipped') return 'completed'
  return null
}

const EVENT_TYPE_LABELS: Record<OrderEvent['event_type'], string> = {
  order_created: 'Pedido criado',
  order_edited: 'Pedido editado',
  payment_confirmed: 'Pagamento confirmado',
  order_cancelled: 'Pedido cancelado',
  status_changed: 'Status alterado',
  stock_changed: 'Estoque',
  email_sent: 'E-mail',
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  order_received: 'Pedido recebido',
  payment_confirmed: 'Pagamento confirmado',
  order_shipped: 'Pedido enviado',
  order_completed: 'Pedido concluído',
}

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [editableItems, setEditableItems] = useState<EditableItem[]>([])

  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [events, setEvents] = useState<OrderEvent[]>([])
  const [emailLogs, setEmailLogs] = useState<OrderEmailLog[]>([])

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [nextOrder, nextProducts, nextEvents, nextEmailLogs] = await Promise.all([
        getOrder(id),
        listAdminProducts(),
        listOrderEvents(id),
        listOrderEmailLogs(id),
      ])
      const activeProducts = nextProducts.filter((product) => product.status === 'active')
      setOrder(nextOrder)
      setProducts(activeProducts)
      setEvents(nextEvents)
      setEmailLogs(nextEmailLogs)
      setCustomerName(nextOrder.customer_name)
      setCustomerPhone(nextOrder.customer_phone)
      setCustomerEmail(nextOrder.customer_email)
      setNotes(nextOrder.notes ?? '')
      setDiscountAmount(String(nextOrder.discount_amount))
      setEditableItems(itemsToEditable(nextOrder.items))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o pedido.')
    } finally {
      setLoading(false)
    }
  }

  function resetEditForm(current: OrderWithItems) {
    setCustomerName(current.customer_name)
    setCustomerPhone(current.customer_phone)
    setCustomerEmail(current.customer_email)
    setNotes(current.notes ?? '')
    setDiscountAmount(String(current.discount_amount))
    setEditableItems(itemsToEditable(current.items))
  }

  useEffect(() => {
    void load()
  }, [id])

  const previewItems = useMemo(() => {
    return editableItems.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)
      const variant = product?.variants.find((entry) => entry.id === item.variantId)
      const lineTotal = item.quantity * item.unitPrice
      return {
        product_name: product?.name ?? 'Produto',
        variation_name: variant?.size_label ?? '—',
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: lineTotal,
      }
    })
  }, [editableItems, products])

  const previewSubtotal = useMemo(
    () => previewItems.reduce((sum, item) => sum + item.total_price, 0),
    [previewItems],
  )
  const previewDiscount = Number(discountAmount) || 0
  const previewTotal = Math.max(previewSubtotal - previewDiscount, 0)

  const canEdit = order ? !['cancelled', 'completed'].includes(order.status) : false
  const canCancel = canEdit
  const canConfirmPayment = order?.status === 'pending_payment'
  const statusAdvance = order ? nextStatus(order.status) : null
  const whatsappHref = order ? buildWhatsAppLink(order.customer_phone, `Olá, ${order.customer_name}! Sobre o pedido ${order.order_number}:`) : null

  async function handleSaveEdit() {
    if (!order) return

    const items: OrderItemInput[] = editableItems
      .filter((item) => item.productId && item.variantId && item.quantity > 0)
      .map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }))

    if (items.length === 0) {
      toast.error('Adicione ao menos um item ao pedido.')
      return
    }

    setSubmitting(true)
    try {
      await updateOrder(order.id, {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_email: customerEmail.trim(),
        notes,
        discount_amount: previewDiscount,
        items,
      })
      toast.success('Pedido atualizado.')
      setEditing(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível salvar o pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmPayment() {
    if (!order) return
    setSubmitting(true)
    try {
      await confirmOrderPayment(order.id, paymentMethod)
      void queueOrderPaidEmail(order.id)
      toast.success('Pagamento confirmado e estoque atualizado.')
      setConfirmPaymentOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível confirmar o pagamento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!order) return
    setSubmitting(true)
    try {
      await cancelOrder(order.id)
      toast.success('Pedido cancelado.')
      setCancelOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAdvanceStatus() {
    if (!order || !statusAdvance) return
    setSubmitting(true)
    try {
      await updateOrderStatus(order.id, statusAdvance)
      if (statusAdvance === 'shipped') {
        void queueOrderShippedEmail(order.id)
      } else if (statusAdvance === 'completed') {
        void queueOrderCompletedEmail(order.id)
      }
      toast.success(`Status atualizado para ${ORDER_STATUS_LABELS[statusAdvance]}.`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar o status.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <PageLoader />
  if (error || !order) {
    return (
      <div>
        <ErrorState message={error ?? 'Pedido não encontrado.'} onRetry={load} />
        <Link to="/admin/pedidos" className="mt-4 inline-block text-sm text-metal-300 hover:text-white">
          Voltar para pedidos
        </Link>
      </div>
    )
  }

  const subtotal = orderSubtotal(order.items)

  return (
    <div>
      <Seo title={`Pedido ${order.order_number}`} robots="noindex, nofollow" />

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link to="/admin/pedidos" className="text-sm text-metal-400 hover:text-white">
            ← Voltar para pedidos
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl">Pedido {order.order_number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-metal-400">
            Criado em {formatDate(order.created_at)}
            {order.paid_at ? ` · Pago em ${formatDate(order.paid_at)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canConfirmPayment ? (
            <Button onClick={() => setConfirmPaymentOpen(true)} disabled={submitting}>
              Confirmar pagamento
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="ghost"
              onClick={() => {
                resetEditForm(order)
                setEditing((current) => !current)
              }}
              disabled={submitting}
            >
              {editing ? 'Cancelar edição' : 'Editar pedido'}
            </Button>
          ) : null}
          {statusAdvance ? (
            <Button variant="ghost" onClick={handleAdvanceStatus} disabled={submitting}>
              Marcar como {ORDER_STATUS_LABELS[statusAdvance]}
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)} disabled={submitting}>
              Cancelar pedido
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSaveEdit()
          }}
        >
          <section className="rounded-2xl border border-white/10 p-5">
            <h2 className="font-medium text-white">Cliente</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Nome">
                <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
              </Field>
              <Field label="WhatsApp">
                <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} required />
              </Field>
              <Field label="E-mail">
                <Input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required />
              </Field>
              <Field label="Desconto (R$)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Observação">
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="font-medium text-white">Produtos</h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const first = products[0]
                  if (!first) return
                  setEditableItems((current) => [...current, createEditableItem(first)])
                }}
              >
                Adicionar produto
              </Button>
            </div>

            <div className="space-y-4">
              {editableItems.map((item, index) => {
                const product = products.find((entry) => entry.id === item.productId)
                const variants = product?.variants.filter((variant) => variant.active) ?? []

                return (
                  <div key={item.key} className="grid gap-3 rounded-xl border border-white/10 p-4 md:grid-cols-5">
                    <Field label="Produto">
                      <Select
                        value={item.productId}
                        onChange={(event) => {
                          const nextProduct = products.find((entry) => entry.id === event.target.value)
                          const nextItem = createEditableItem(nextProduct)
                          setEditableItems((current) =>
                            current.map((entry, entryIndex) => (entryIndex === index ? { ...nextItem, key: entry.key, id: entry.id } : entry)),
                          )
                        }}
                      >
                        <option value="">Selecione</option>
                        {products.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Tamanho">
                      <Select
                        value={item.variantId}
                        onChange={(event) => {
                          setEditableItems((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, variantId: event.target.value } : entry,
                            ),
                          )
                        }}
                      >
                        <option value="">Selecione</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.size_label} ({variant.quantity} un)
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Quantidade">
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => {
                          const quantity = Number(event.target.value)
                          setEditableItems((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, quantity } : entry,
                            ),
                          )
                        }}
                      />
                    </Field>
                    <Field label="Preço unitário">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) => {
                          const unitPrice = Number(event.target.value)
                          setEditableItems((current) =>
                            current.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, unitPrice } : entry,
                            ),
                          )
                        }}
                      />
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditableItems((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-metal-400">Subtotal</span>
                <span>{formatCurrency(previewSubtotal)}</span>
              </div>
              {previewDiscount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-metal-400">Desconto</span>
                  <span>- {formatCurrency(previewDiscount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-medium text-white">
                <span>Total</span>
                <span>{formatCurrency(previewTotal)}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={submitting}>
                Descartar
              </Button>
            </div>
          </section>
        </form>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-medium text-white">Cliente</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div>
                  <dt className="text-metal-400">Nome</dt>
                  <dd className="text-white">{order.customer_name}</dd>
                </div>
                <div>
                  <dt className="text-metal-400">WhatsApp</dt>
                  <dd>
                    {whatsappHref ? (
                      <a href={whatsappHref} target="_blank" rel="noreferrer" className="text-white hover:underline">
                        {order.customer_phone}
                      </a>
                    ) : (
                      order.customer_phone
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-metal-400">E-mail</dt>
                  <dd className="text-white">{order.customer_email}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-medium text-white">Produtos</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-metal-400">
                    <tr>
                      <th className="pb-2 font-medium">Produto</th>
                      <th className="pb-2 font-medium">Variação</th>
                      <th className="pb-2 font-medium">Qtd</th>
                      <th className="pb-2 font-medium">Unitário</th>
                      <th className="pb-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => (
                      <tr key={item.id ?? `${item.product_id}-${item.variation_id}`} className="border-t border-white/10">
                        <td className="py-3 text-white">{item.product_name}</td>
                        <td className="py-3">{item.variation_name ?? '—'}</td>
                        <td className="py-3">{item.quantity}</td>
                        <td className="py-3">{formatCurrency(item.unit_price)}</td>
                        <td className="py-3">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {order.notes ? (
              <section className="rounded-2xl border border-white/10 p-5">
                <h2 className="font-medium text-white">Observação</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm text-metal-300">{order.notes}</p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-white/10 p-5">
              <h2 className="font-medium text-white">Histórico</h2>
              {events.length === 0 && emailLogs.length === 0 ? (
                <p className="mt-3 text-sm text-metal-500">Nenhum evento registrado ainda.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {events.map((event) => (
                    <li key={event.id} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">{event.message}</p>
                          <p className="mt-1 text-xs text-metal-500">
                            {EVENT_TYPE_LABELS[event.event_type]} · {formatDate(event.created_at)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                  {emailLogs.map((log) => (
                    <li key={`email-${log.id}`} className="border-t border-white/10 pt-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-white">
                            E-mail {EMAIL_TYPE_LABELS[log.email_type] ?? log.email_type} — {log.status}
                          </p>
                          <p className="mt-1 text-xs text-metal-500">
                            {log.customer_email} · {formatDate(log.created_at)}
                          </p>
                          {log.error_message ? (
                            <p className="mt-1 text-xs text-red-400">{log.error_message}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="h-fit space-y-4 rounded-2xl border border-white/10 p-5">
            <div>
              <p className="text-sm text-metal-400">Status atual</p>
              <div className="mt-2">
                <OrderStatusBadge status={order.status} />
              </div>
            </div>
            {order.payment_method ? (
              <div>
                <p className="text-sm text-metal-400">Pagamento</p>
                <p className="mt-1 text-white">{PAYMENT_LABELS[order.payment_method]}</p>
              </div>
            ) : null}
            <div className="space-y-2 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-metal-400">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {order.discount_amount > 0 ? (
                <div className="flex justify-between">
                  <span className="text-metal-400">Desconto</span>
                  <span>- {formatCurrency(order.discount_amount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-medium text-white">
                <span>Total</span>
                <span>{formatCurrency(order.total_amount)}</span>
              </div>
            </div>
          </aside>
        </div>
      )}

      <Modal open={confirmPaymentOpen} title="Confirmar pagamento" onClose={() => setConfirmPaymentOpen(false)}>
        <p className="text-sm text-metal-300">
          Confirma o pagamento do pedido <strong className="text-white">{order.order_number}</strong> no valor de{' '}
          <strong className="text-white">{formatCurrency(order.total_amount)}</strong>? O estoque será baixado e a venda
          registrada no faturamento.
        </p>
        <div className="mt-4">
          <Field label="Forma de pagamento">
            <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirmPaymentOpen(false)} disabled={submitting}>
            Voltar
          </Button>
          <Button onClick={handleConfirmPayment} disabled={submitting}>
            {submitting ? 'Confirmando…' : 'Confirmar pagamento'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar pedido"
        description={
          order.status === 'pending_payment'
            ? 'Deseja cancelar este pedido? Nenhuma alteração de estoque será feita.'
            : 'Deseja cancelar este pedido? O estoque será devolvido e a venda registrada será mantida no histórico.'
        }
        confirmLabel="Cancelar pedido"
        danger
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
      />
    </div>
  )
}
