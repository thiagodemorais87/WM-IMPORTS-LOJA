import { Link } from 'react-router-dom'
import type { ProductWithRelations } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, effectivePrice } from '@/lib/format'
import { availableSizes, productHasStock } from '@/lib/stock'

export function ProductCard({ product }: { product: ProductWithRelations }) {
  const image = product.images.find((item) => item.is_primary) ?? product.images[0]
  const inStock = productHasStock(product.variants)
  const price = effectivePrice(product.price, product.promotional_price)
  const sizes = availableSizes(product.variants).filter((variant) => variant.quantity > 0)

  return (
    <Link
      to={`/produto/${product.slug}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-panel transition hover:-translate-y-1 hover:border-metal-400/40 hover:shadow-[var(--shadow-metal)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-ink-soft">
        {image ? (
          <img
            src={image.url}
            alt={image.alt || product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-metal-600">Sem imagem</div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {product.is_new ? <Badge>Novo</Badge> : null}
          {!inStock ? <Badge tone="danger">Esgotado</Badge> : <Badge tone="success">Disponível</Badge>}
        </div>
      </div>
      <div className="space-y-2 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-metal-500">{product.category?.name}</p>
        <h3 className="font-display text-lg leading-tight text-white">{product.name}</h3>
        <div className="flex items-baseline gap-2">
          {product.promotional_price && product.promotional_price < product.price ? (
            <span className="text-xs text-metal-500 line-through">{formatCurrency(product.price)}</span>
          ) : null}
          <span className="text-metal-100">{formatCurrency(price)}</span>
        </div>
        <p className="text-xs text-metal-500">
          {inStock ? sizes.map((size) => size.size_label).join(' · ') || 'Disponível' : 'Indisponível no momento'}
        </p>
        <span className="inline-block pt-1 text-sm text-metal-300 group-hover:text-white">Ver produto →</span>
      </div>
    </Link>
  )
}
