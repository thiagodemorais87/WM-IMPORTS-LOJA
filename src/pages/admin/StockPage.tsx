import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { listAdminProducts } from '@/services/products.service'
import { adjustStock, listStockMovements } from '@/services/stock.service'
import { formatDate } from '@/lib/format'
import { MOVEMENT_LABELS } from '@/constants'
import type { ProductWithRelations, StockMovement, StockMovementType } from '@/types'

export function StockPage() {
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [productId, setProductId] = useState('')
  const [variantId, setVariantId] = useState('')
  const [type, setType] = useState<Exclude<StockMovementType, 'venda'>>('entrada')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')

  const selected = products.find((product) => product.id === productId)

  async function load() {
    const [nextProducts, nextMovements] = await Promise.all([listAdminProducts(), listStockMovements()])
    setProducts(nextProducts)
    setMovements(nextMovements)
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div>
      <Seo title="Estoque" />
      <h1 className="font-display text-3xl">Estoque</h1>
      <form
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 p-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await adjustStock({ variant_id: variantId, type, quantity, reason })
            toast.success('Estoque atualizado.')
            setReason('')
            await load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível ajustar o estoque.')
          }
        }}
      >
        <Field label="Produto">
          <Select
            required
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value)
              const product = products.find((item) => item.id === event.target.value)
              setVariantId(product?.variants[0]?.id ?? '')
            }}
          >
            <option value="">Selecione</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Variação">
          <Select required value={variantId} onChange={(event) => setVariantId(event.target.value)}>
            <option value="">Selecione</option>
            {selected?.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.size_label} — atual {variant.quantity}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={type} onChange={(event) => setType(event.target.value as Exclude<StockMovementType, 'venda'>)}>
            <option value="entrada">Entrada</option>
            <option value="ajuste">Ajuste (definir quantidade final)</option>
            <option value="devolucao">Devolução</option>
          </Select>
        </Field>
        <Field label={type === 'ajuste' ? 'Quantidade final' : 'Quantidade'}>
          <Input type="number" min={type === 'ajuste' ? 0 : 1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
        </Field>
        <div className="md:col-span-2">
          <Field label="Motivo">
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
        <Button>Aplicar</Button>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-white/5 text-metal-400">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Variação</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Qtd</th>
              <th className="px-4 py-3">Anterior</th>
              <th className="px-4 py-3">Atual</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t border-white/10">
                <td className="px-4 py-3">{formatDate(movement.created_at)}</td>
                <td className="px-4 py-3">{movement.product?.name ?? '—'}</td>
                <td className="px-4 py-3">{movement.variant?.size_label ?? '—'}</td>
                <td className="px-4 py-3">{MOVEMENT_LABELS[movement.type]}</td>
                <td className="px-4 py-3">{movement.quantity_change}</td>
                <td className="px-4 py-3">{movement.quantity_before}</td>
                <td className="px-4 py-3">{movement.quantity_after}</td>
                <td className="px-4 py-3">{movement.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
