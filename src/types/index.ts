export type UserRole = 'admin' | 'none'

export type ProductStatus = 'draft' | 'active' | 'archived'

export type PaymentMethod = 'pix' | 'dinheiro' | 'cartao' | 'outro'

export type StockMovementType = 'entrada' | 'venda' | 'ajuste' | 'devolucao'

export type BannerType = 'institutional' | 'promotion' | 'announcement' | 'collection'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  display_order: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  additional_info: string | null
  sku: string | null
  price: number
  promotional_price: number | null
  status: ProductStatus
  featured: boolean
  is_new: boolean
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  storage_path: string
  alt: string | null
  is_primary: boolean
  display_order: number
  created_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  size_label: string
  sku: string | null
  /** Quantidade exata — disponível só para admin autenticado */
  quantity: number
  /** Limite público para pedido (least(quantity, 10)); anon recebe só isto */
  max_request_qty?: number
  /** Disponibilidade pública (anon não recebe quantity) */
  in_stock?: boolean
  active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export interface ProductWithRelations extends Product {
  category: Category | null
  images: ProductImage[]
  variants: ProductVariant[]
}

export interface Sale {
  id: string
  customer_name: string | null
  payment_method: PaymentMethod
  notes: string | null
  total: number
  sold_at: string
  user_id: string | null
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  variant_id: string
  product_name: string
  size_label: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface SaleWithItems extends Sale {
  items: SaleItem[]
}

export interface StockMovement {
  id: string
  product_id: string
  variant_id: string
  sale_id: string | null
  type: StockMovementType
  quantity_change: number
  quantity_before: number
  quantity_after: number
  reason: string | null
  user_id: string | null
  created_at: string
  product?: Pick<Product, 'id' | 'name'> | null
  variant?: Pick<ProductVariant, 'id' | 'size_label'> | null
}

export interface StoreSettings {
  id: number
  store_name: string
  logo_url: string | null
  whatsapp: string | null
  instagram: string | null
  description: string | null
  address: string | null
  city: string
  state: string
  business_hours: string | null
  low_stock_threshold: number
  whatsapp_message_template: string | null
  tagline: string
  created_at: string
  updated_at: string
}

export interface Banner {
  id: string
  title: string
  subtitle: string | null
  extra_text: string | null
  image_url: string | null
  storage_path: string | null
  button_text: string | null
  button_link: string | null
  type: BannerType
  active: boolean
  display_order: number
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface StoreHighlight {
  id: string
  title: string
  description: string | null
  icon: string
  active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

export type OrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'shipped' | 'completed' | 'cancelled'

export type OrderEmailType = 'order_received' | 'payment_confirmed' | 'order_shipped' | 'order_completed'

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  notes: string | null
  status: OrderStatus
  payment_method: PaymentMethod | null
  sale_id: string | null
  discount_amount: number
  total_amount: number
  created_at: string
  updated_at: string
  paid_at: string | null
}

export interface OrderItem {
  id?: string
  order_id?: string
  product_id: string
  product_name: string
  variation_id: string | null
  variation_name: string | null
  quantity: number
  unit_price: number
  total_price: number
}

export interface OrderWithItems extends Order {
  items: OrderItem[]
}

export interface CreateOrderInput {
  customer_name: string
  customer_phone: string
  customer_email: string
  notes?: string
  items: { variant_id: string; quantity: number }[]
}

export interface CreateOrderResult {
  id: string
  order_number: string
  total_amount: number
  items: OrderItem[]
}

export interface OrderItemInput {
  id?: string
  variant_id: string
  quantity: number
  unit_price: number
}

export interface UpdateOrderInput {
  customer_name: string
  customer_phone: string
  customer_email: string
  notes?: string
  discount_amount: number
  items: OrderItemInput[]
}

export function orderSubtotal(items: OrderItem[]) {
  return items.reduce((sum, item) => sum + item.total_price, 0)
}

export function orderTotalFromItems(items: OrderItem[], discountAmount: number) {
  return Math.max(orderSubtotal(items) - discountAmount, 0)
}

export interface CartItem {
  productId: string
  variantId: string
  name: string
  sizeLabel: string
  quantity: number
  unitPrice: number
  imageUrl: string | null
  maxQuantity: number
}

export interface CatalogFilters {
  search: string
  categorySlug: string
  size: string
  availability: 'all' | 'in_stock' | 'out_of_stock'
  minPrice: string
  maxPrice: string
  sort: 'recent' | 'price_asc' | 'price_desc' | 'name'
}

export type OrderEventType =
  | 'order_created'
  | 'order_edited'
  | 'payment_confirmed'
  | 'order_cancelled'
  | 'status_changed'
  | 'stock_changed'
  | 'email_sent'

export interface OrderEvent {
  id: string
  order_id: string
  event_type: OrderEventType
  message: string
  metadata: Record<string, unknown> | null
  user_id: string | null
  created_at: string
}

export interface OrderEmailLog {
  id: string
  order_id: string
  customer_email: string
  email_type: string
  status: string
  provider_id: string | null
  error_message: string | null
  created_at: string
}

export interface DashboardStats {
  totalProducts: number
  activeProducts: number
  outOfStock: number
  lowStock: number
  totalUnits: number
  pendingPaymentCount: number
  salesTodayCount: number
  revenueToday: number
  salesMonthCount: number
  revenueMonth: number
  averageTicket: number
  productsSoldMonth: number
  topProducts: { name: string; quantity: number }[]
  salesByDay: { date: string; total: number; count: number }[]
}
