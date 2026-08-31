export const APP_NAME = 'WM Imports'
export const APP_TAGLINE = 'De Sertânia para todo o Brasil.'
export const APP_LOCATION = 'Sertânia/PE'
export const SITE_URL = 'https://wmimportspe.com.br'
export const DEFAULT_SEO_DESCRIPTION =
  'WM Imports — moda, estilo e qualidade. Loja em Sertânia/PE com envio para todo o Brasil. Camisas, polos, t-shirts, calças e óculos.'

export const PAYMENT_LABELS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  outro: 'Outro',
} as const

export const MOVEMENT_LABELS = {
  entrada: 'Entrada',
  venda: 'Venda',
  ajuste: 'Ajuste',
  devolucao: 'Devolução',
} as const

export const PRODUCT_STATUS_LABELS = {
  draft: 'Rascunho',
  active: 'Ativo',
  archived: 'Arquivado',
} as const

export const BANNER_TYPE_LABELS = {
  institutional: 'Institucional',
  promotion: 'Promoção',
  announcement: 'Comunicado',
  collection: 'Coleção',
} as const

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024
export const MAX_PRODUCT_IMAGES = 8
export const PRODUCT_IMAGE_MAX_EDGE = 1600
export const PRODUCT_IMAGE_QUALITY = 0.8

export const DEFAULT_FILTERS = {
  search: '',
  categorySlug: '',
  size: '',
  availability: 'all' as const,
  minPrice: '',
  maxPrice: '',
  sort: 'recent' as const,
}

export const LOW_STOCK_DEFAULT = 3

export const ADMIN_LOGIN_MAX_ATTEMPTS = 5
export const ADMIN_LOGIN_LOCKOUT_MS = 15 * 60 * 1000
export const ADMIN_LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000

/** Logout automático após inatividade no painel (ms). */
export const ADMIN_SESSION_INACTIVITY_MS = 30 * 60 * 1000
