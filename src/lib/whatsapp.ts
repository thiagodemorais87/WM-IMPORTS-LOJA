import type { CartItem, Product, StoreSettings } from '@/types'
import { digitsOnly, effectivePrice, formatCurrency } from '@/lib/format'

export function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const digits = digitsOnly(phone ?? '')
  if (!digits) return null
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`
}

export function productInterestMessage(
  settings: StoreSettings | null,
  product: Pick<Product, 'name' | 'price' | 'promotional_price'>,
  sizeLabel: string,
  quantity: number,
) {
  const intro = settings?.whatsapp_message_template?.trim() || 'Olá! Tenho interesse no produto WM Imports:'
  const price = effectivePrice(product.price, product.promotional_price)
  return [
    intro,
    '',
    `Produto: ${product.name}`,
    `Tamanho: ${sizeLabel}`,
    `Quantidade: ${quantity}`,
    `Valor: ${formatCurrency(price * quantity)}`,
  ].join('\n')
}

export function cartRequestMessage(settings: StoreSettings | null, items: CartItem[]) {
  const store = settings?.store_name ?? 'WM Imports'
  const lines = items.map((item, index) => {
    const size = item.sizeLabel && item.sizeLabel !== 'Único' ? ` — ${item.sizeLabel}` : ''
    return `${index + 1}. ${item.name}${size} — ${item.quantity} ${item.quantity === 1 ? 'unidade' : 'unidades'}`
  })

  return [
    `Olá! Gostaria de fazer uma solicitação na ${store}:`,
    '',
    ...lines,
    '',
    'Gostaria de confirmar disponibilidade e valor.',
  ].join('\n')
}

export function instagramUrl(handle: string | null | undefined) {
  if (!handle) return null
  const clean = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  if (!clean) return null
  return `https://instagram.com/${clean}`
}
