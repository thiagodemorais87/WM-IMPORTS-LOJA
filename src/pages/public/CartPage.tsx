import { Link } from 'react-router-dom'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCart } from '@/contexts/CartContext'
import { formatCurrency } from '@/lib/format'

export function CartPage() {
  const { items, updateQuantity, removeItem, clear, count } = useCart()
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Seo title="Carrinho" path="/carrinho" robots="noindex, nofollow" />
      <h1 className="font-display text-4xl">Carrinho</h1>
      <p className="mt-2 text-sm text-metal-400">
        Isto é apenas uma intenção de compra. Não há pagamento online. Preço e disponibilidade finais são confirmados
        pelo WhatsApp com a loja.
      </p>

      {count === 0 ? (
        <div className="mt-10">
          <EmptyState title="Seu carrinho está vazio." action={<Link to="/produtos"><Button>Ver produtos</Button></Link>} />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {items.map((item) => (
            <div key={item.variantId} className="flex gap-4 rounded-2xl border border-white/10 bg-panel p-4">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="h-24 w-20 rounded-xl object-cover" />
              ) : (
                <div className="h-24 w-20 rounded-xl bg-ink-soft" />
              )}
              <div className="flex-1">
                <h2 className="font-medium text-white">{item.name}</h2>
                <p className="text-sm text-metal-400">Tamanho: {item.sizeLabel}</p>
                <p className="mt-1 text-sm">{formatCurrency(item.unitPrice)}</p>
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-metal-500" htmlFor={`qty-${item.variantId}`}>Qtd</label>
                  <input
                    id={`qty-${item.variantId}`}
                    type="number"
                    min={1}
                    max={item.maxQuantity}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(item.variantId, Number(event.target.value))}
                    className="h-9 w-16 rounded-lg border border-line bg-ink px-2 text-sm"
                  />
                  <button className="text-sm text-red-300" onClick={() => removeItem(item.variantId)}>
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-white/10 pt-6">
            <span className="text-metal-400">Estimativa (não é cobrança)</span>
            <span className="text-xl text-white">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-metal-500">
            Revise seus itens e finalize o pedido. Você informará seus dados na próxima etapa e será direcionado ao
            WhatsApp.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/checkout" className="flex-1">
              <Button variant="whatsapp" className="w-full">
                Finalizar pedido
              </Button>
            </Link>
            <Link to="/produtos" className="flex-1">
              <Button variant="ghost" className="w-full">
                Continuar comprando
              </Button>
            </Link>
            <Button variant="ghost" onClick={clear}>
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
