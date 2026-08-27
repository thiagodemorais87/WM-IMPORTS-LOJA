import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { ProductGallery } from '@/components/public/ProductGallery'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { ErrorState, EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { getPublicProduct } from '@/services/products.service'
import { useCart } from '@/contexts/CartContext'
import { useSettings } from '@/contexts/SettingsContext'
import { availableSizes, productHasStock, publicMaxQuantity, variantIsInStock } from '@/lib/stock'
import { effectivePrice, formatCurrency } from '@/lib/format'
import { buildWhatsAppLink, productInterestMessage } from '@/lib/whatsapp'
import type { ProductWithRelations } from '@/types'

export function ProductDetailPage() {
  const { id } = useParams()
  const { addItem } = useCart()
  const settings = useSettings()
  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [variantId, setVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPublicProduct(id)
      .then((data) => {
        setProduct(data)
        const first =
          data?.variants.find((variant) => variantIsInStock(variant)) ?? data?.variants[0]
        setVariantId(first?.id ?? '')
        setQuantity(1)
      })
      .catch(() => setError('Não foi possível carregar o produto.'))
      .finally(() => setLoading(false))
  }, [id])

  const variant = product?.variants.find((item) => item.id === variantId)
  const sizes = product ? availableSizes(product.variants) : []
  const maxQty = variant ? publicMaxQuantity(variant) : 0
  const inStock = product ? productHasStock(product.variants) : false
  const price = product ? effectivePrice(product.price, product.promotional_price) : 0

  useEffect(() => {
    if (maxQty <= 0) {
      setQuantity(1)
      return
    }
    setQuantity((current) => Math.min(current, maxQty))
  }, [maxQty, variantId])

  const waHref = useMemo(() => {
    if (!product || !variant) return null
    return buildWhatsAppLink(settings?.whatsapp, productInterestMessage(settings, product, variant.size_label, quantity))
  }, [product, variant, quantity, settings])

  if (loading) return <PageLoader />
  if (error) return <div className="mx-auto max-w-7xl px-4 py-16"><ErrorState message={error} /></div>
  if (!product) return <div className="mx-auto max-w-7xl px-4 py-16"><EmptyState title="Produto não encontrado." /></div>

  const image = product.images.find((item) => item.is_primary) ?? product.images[0]

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <Seo
        title={product.name}
        description={product.description ?? `${product.name} na WM Imports.`}
        image={image?.url}
      />
      <ProductGallery images={product.images} name={product.name} />
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-metal-500">{product.category?.name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {product.is_new ? <Badge>Novo</Badge> : null}
          {inStock ? <Badge tone="success">Disponível</Badge> : <Badge tone="danger">Esgotado</Badge>}
        </div>
        <h1 className="mt-4 font-display text-4xl">{product.name}</h1>
        <div className="mt-4 flex items-baseline gap-3">
          {product.promotional_price && product.promotional_price < product.price ? (
            <span className="text-metal-500 line-through">{formatCurrency(product.price)}</span>
          ) : null}
          <span className="text-2xl text-white">{formatCurrency(price)}</span>
        </div>
        {product.description ? <p className="mt-6 leading-relaxed text-metal-300">{product.description}</p> : null}

        <div className="mt-8 space-y-4">
          <div>
            <p className="mb-2 text-sm text-metal-400">Tamanho</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((item) => {
                const soldOut = !variantIsInStock(item)
                return (
                  <button
                    key={item.id}
                    disabled={soldOut}
                    onClick={() => {
                      setVariantId(item.id)
                      setQuantity(1)
                    }}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      item.id === variantId
                        ? 'border-metal-200 bg-metal-200 text-ink'
                        : soldOut
                          ? 'cursor-not-allowed border-white/10 text-metal-600'
                          : 'border-white/15 text-metal-200 hover:border-metal-300'
                    }`}
                  >
                    {item.size_label}
                    {soldOut ? ' — Esgotado' : ' — Disponível'}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-metal-400" htmlFor="qty">Quantidade desejada</label>
            <Select
              id="qty"
              className="max-w-32"
              value={quantity}
              disabled={!maxQty}
              onChange={(event) => setQuantity(Math.min(maxQty, Math.max(1, Number(event.target.value))))}
            >
              {Array.from({ length: Math.max(maxQty, 0) }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
            {!maxQty ? (
              <p className="mt-2 text-sm text-red-300">Este tamanho está esgotado.</p>
            ) : (
              <p className="mt-2 text-xs text-metal-500">A disponibilidade final é confirmada no WhatsApp.</p>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button
            disabled={!variant || !maxQty}
            onClick={() => {
              if (!variant || !product) return
              addItem({
                productId: product.id,
                variantId: variant.id,
                name: product.name,
                sizeLabel: variant.size_label,
                quantity,
                unitPrice: price,
                imageUrl: image?.url ?? null,
                maxQuantity: publicMaxQuantity(variant),
              })
              toast.success('Produto adicionado ao carrinho.')
            }}
          >
            Adicionar ao carrinho
          </Button>
          {waHref && variant && maxQty ? (
            <a href={waHref} target="_blank" rel="noreferrer">
              <Button variant="whatsapp">Comprar pelo WhatsApp</Button>
            </a>
          ) : (
            <Button variant="whatsapp" disabled>
              Comprar pelo WhatsApp
            </Button>
          )}
        </div>
        {!settings?.whatsapp ? (
          <p className="mt-3 text-xs text-metal-500">O WhatsApp da loja ainda não foi configurado no painel.</p>
        ) : null}

        {product.additional_info ? (
          <div className="mt-10 border-t border-white/10 pt-6">
            <h2 className="font-display text-lg">Informações adicionais</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-metal-400">{product.additional_info}</p>
          </div>
        ) : null}

        <Link to="/produtos" className="mt-8 inline-block text-sm text-metal-400 hover:text-white">
          ← Voltar ao catálogo
        </Link>
      </div>
    </div>
  )
}
