import type { CartItem } from '@/types'

const STORAGE_KEY = 'wm-imports-buy-now'

export function getBuyNowItems(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CartItem | CartItem[]
    if (Array.isArray(parsed)) return parsed
    return parsed ? [parsed] : []
  } catch {
    return []
  }
}

export function setBuyNowItem(item: CartItem) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([item]))
}

export function clearBuyNow() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function hasBuyNow(): boolean {
  return getBuyNowItems().length > 0
}
