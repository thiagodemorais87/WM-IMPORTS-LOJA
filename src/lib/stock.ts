import type { ProductVariant } from '@/types'
import { PUBLIC_MAX_REQUEST_QTY } from '@/lib/format'

export function variantIsInStock(variant: Pick<ProductVariant, 'quantity' | 'in_stock' | 'active'>) {
  if (!variant.active) return false
  if (typeof variant.in_stock === 'boolean') return variant.in_stock
  return variant.quantity > 0
}

export function variantStockStatus(variant: Pick<ProductVariant, 'quantity' | 'in_stock'>) {
  if (typeof variant.in_stock === 'boolean') {
    return variant.in_stock ? ('in' as const) : ('out' as const)
  }
  if (variant.quantity <= 0) return 'out' as const
  return 'in' as const
}

export function productHasStock(variants: ProductVariant[]) {
  return variants.some((variant) => variantIsInStock(variant))
}

export function availableSizes(variants: ProductVariant[]) {
  return variants.filter((variant) => variant.active)
}

export function totalStock(variants: Array<Pick<ProductVariant, 'quantity'>>) {
  return variants.reduce((sum, variant) => sum + variant.quantity, 0)
}

export function isLowStock(quantity: number, threshold: number) {
  return quantity > 0 && quantity <= threshold
}

/** Max para solicitação pública (WhatsApp/carrinho) sem vazar estoque exato acima do teto */
export function publicMaxQuantity(
  variant: Pick<ProductVariant, 'quantity' | 'in_stock' | 'active' | 'max_request_qty'>,
) {
  if (!variantIsInStock(variant)) return 0
  if (variant.quantity > 0) return Math.min(variant.quantity, PUBLIC_MAX_REQUEST_QTY)
  if (variant.max_request_qty != null && variant.max_request_qty > 0) return variant.max_request_qty
  return 0
}
