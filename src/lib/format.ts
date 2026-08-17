export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDateOnly(value: string | Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(value))
}

export function effectivePrice(price: number, promotionalPrice: number | null) {
  if (promotionalPrice != null && promotionalPrice > 0 && promotionalPrice < price) {
    return promotionalPrice
  }
  return price
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}
