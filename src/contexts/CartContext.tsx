import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CartItem } from '@/types'

const STORAGE_KEY = 'wm-imports-cart'

interface CartContextValue {
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (variantId: string, quantity: number) => void
  removeItem: (variantId: string) => void
  clear: () => void
  count: number
}

const CartContext = createContext<CartContextValue | null>(null)

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => (typeof window === 'undefined' ? [] : readCart()))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem: (item) => {
        setItems((current) => {
          const existing = current.find((entry) => entry.variantId === item.variantId)
          if (!existing) return [...current, item]
          const quantity = Math.min(existing.maxQuantity, existing.quantity + item.quantity)
          return current.map((entry) => (entry.variantId === item.variantId ? { ...entry, quantity } : entry))
        })
      },
      updateQuantity: (variantId, quantity) => {
        setItems((current) =>
          current.map((entry) =>
            entry.variantId === variantId
              ? { ...entry, quantity: Math.max(1, Math.min(entry.maxQuantity, quantity)) }
              : entry,
          ),
        )
      },
      removeItem: (variantId) => {
        setItems((current) => current.filter((entry) => entry.variantId !== variantId))
      },
      clear: () => setItems([]),
      count: items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    [items],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider')
  return context
}
