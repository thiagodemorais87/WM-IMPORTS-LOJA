import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { listAdminProducts } from '@/services/products.service'
import { listSales, registerSale } from '@/services/sales.service'
import { formatCurrency, formatDate } from '@/lib/format'
import { PAYMENT_LABELS } from '@/constants'
import type { PaymentMethod, ProductWithRelations, SaleWithItems } from '@/types'

export function SalesPage() {
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [customer, setCustomer] = useState('')
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<PaymentMethod>('pix')
  const [soldAt, setSoldAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [period, setPeriod] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const selected = products.find((product) => product.id === productId)
  const variant = selected?.variants.find((item) => item.id === variantId)

  async function load() {
    const [nextProducts, nextSales] = await Promise.all([listAdminProducts(), listSales()])
    setProducts(nextProducts)
    setSales(nextSales)
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    return sales.filter((sale) => {
      if (paymentFilter !== 'all' && sale.payment_method !== paymentFilter) return false
      if (period && !sale.sold_at.startsWith(period)) return false
      if (productId && !sale.items.some((item) => item.product_id === productId)) return false
      return true
    })
  }, [sales, paymentFilter, period, productId])

  return (
    <div>
      <Seo title="Vendas" robots="noindex, nofollow" />
      <h1 className="font-display text-3xl">Vendas</h1>
      <form
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 p-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!variant || !selected) return
          try {
            await registerSale({
              customer_name: customer,
              payment_method: payment,
              notes,
              sold_at: new Date(soldAt).toISOString(),
              items: [
                {
                  variant_id: variant.id,
                  quantity,
                },
              ],
            })
            toast.success('Venda registrada e estoque atualizado.')
            setQuantity(1)
            setCustomer('')
            setNotes('')
            await load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a venda.')
          }
        }}
      >
        <Field label="Produto">
          <Select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value)
              const product = products.find((item) => item.id === event.target.value)
              setVariantId(product?.variants[0]?.id ?? '')
            }}
            required
          >
            <option value="">Selecione</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tamanho">
          <Select value={variantId} onChange={(event) => setVariantId(event.target.value)} required>
            <option value="">Selecione</option>
            {selected?.variants.map((item) => (
              <option key={item.id} value={item.id}>
                {item.size_label} ({item.quantity} un.)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quantidade">
          <Input type="number" min="1" max={variant?.quantity ?? 1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
        </Field>
        <Field label="Cliente (opcional)">
          <Input value={customer} onChange={(event) => setCustomer(event.target.value)} />
        </Field>
        <Field label="Pagamento">
          <Select value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="datetime-local" value={soldAt} onChange={(event) => setSoldAt(event.target.value)} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Observação">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          {selected ? (
            <p className="mt-2 text-xs text-metal-500">
              O preço unitário é calculado no servidor a partir do catálogo
              ({formatCurrency(Number(selected.promotional_price ?? selected.price))}).
            </p>
          ) : null}
        </div>
        <Button>Registrar venda</Button>
      </form>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Field label="Período">
          <Input type="date" value={period} onChange={(event) => setPeriod(event.target.value)} />
        </Field>
        <Field label="Pagamento">
          <Select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-white/5 text-metal-400">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Tamanho</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.flatMap((sale) =>
              sale.items.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="px-4 py-3">{formatDate(sale.sold_at)}</td>
                  <td className="px-4 py-3">{item.product_name}</td>
                  <td className="px-4 py-3">{item.size_label}</td>
                  <td className="px-4 py-3">{item.quantity}</td>
                  <td className="px-4 py-3">{formatCurrency(item.subtotal)}</td>
                  <td className="px-4 py-3">{PAYMENT_LABELS[sale.payment_method]}</td>
                  <td className="px-4 py-3">{sale.notes ?? '—'}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
