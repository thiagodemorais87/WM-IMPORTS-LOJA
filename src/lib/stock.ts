import type { ProductVariant } from '@/types'

export function variantStockStatus(quantity: number) {
  if (quantity <= 0) return 'out' as const
  return 'in' as const
}

export function productHasStock(variants: ProductVariant[]) {
  return variants.some((variant) => variant.active && variant.quantity > 0)
}

export function availableSizes(variants: ProductVariant[]) {
  return variants
    .filter((variant) => variant.active)
    .sort((a, b) => a.display_order - b.display_order)
}

export function totalStock(variants: ProductVariant[]) {
  return variants.reduce((sum, variant) => sum + variant.quantity, 0)
}

export function isLowStock(quantity: number, threshold: number) {
  return quantity > 0 && quantity <= threshold
}
