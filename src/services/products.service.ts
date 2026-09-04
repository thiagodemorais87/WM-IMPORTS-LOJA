import { supabase } from '@/lib/supabase'
import type { CatalogFilters, Category, Product, ProductImage, ProductVariant, ProductWithRelations } from '@/types'
import { slugify } from '@/lib/slug'

function mapProduct(row: Partial<Product> & {
  category?: Partial<Category> | null
  product_images?: ProductImage[]
  product_variants?: Array<Partial<ProductVariant> & { in_stock?: boolean; max_request_qty?: number }>
}): ProductWithRelations {
  return {
    id: row.id!,
    category_id: row.category_id ?? null,
    name: row.name ?? '',
    slug: row.slug ?? '',
    description: row.description ?? null,
    additional_info: row.additional_info ?? null,
    sku: row.sku ?? null,
    price: Number(row.price ?? 0),
    promotional_price: row.promotional_price == null ? null : Number(row.promotional_price),
    status: row.status ?? 'draft',
    featured: Boolean(row.featured),
    is_new: Boolean(row.is_new),
    created_at: row.created_at ?? '',
    updated_at: row.updated_at ?? '',
    category: (row.category as Category | null) ?? null,
    images: (row.product_images ?? []).sort((a, b) => a.display_order - b.display_order),
    variants: (row.product_variants ?? [])
      .map((variant) => ({
        id: variant.id!,
        product_id: variant.product_id ?? row.id!,
        size_label: variant.size_label ?? '',
        sku: variant.sku ?? null,
        quantity: Number(variant.quantity ?? 0),
        max_request_qty:
          variant.max_request_qty == null ? undefined : Number(variant.max_request_qty),
        in_stock:
          typeof variant.in_stock === 'boolean'
            ? variant.in_stock
            : Number(variant.quantity ?? 0) > 0,
        active: Boolean(variant.active ?? true),
        display_order: Number(variant.display_order ?? 0),
        created_at: variant.created_at ?? '',
        updated_at: variant.updated_at ?? '',
      }))
      .sort((a, b) => a.display_order - b.display_order),
  }
}

/** Detalhe / edição — grafo completo */
const PRODUCT_SELECT = `
  *,
  category:categories(*),
  product_images(*),
  product_variants(*)
`

/** Cards e catálogo público — sem quantity exata (apenas in_stock) */
const PRODUCT_CARD_SELECT = `
  id, category_id, name, slug, sku, description, additional_info, price, promotional_price, status, featured, is_new, created_at, updated_at,
  category:categories(id, name, slug),
  product_images(id, url, alt, is_primary, display_order),
  product_variants(id, size_label, active, display_order, in_stock)
`

/** Detalhe público — inclui max_request_qty para limitar quantidade no carrinho/WhatsApp */
const PRODUCT_DETAIL_SELECT = `
  id, category_id, name, slug, sku, description, additional_info, price, promotional_price, status, featured, is_new, created_at, updated_at,
  category:categories(id, name, slug),
  product_images(id, url, alt, is_primary, display_order),
  product_variants(id, size_label, active, display_order, in_stock, max_request_qty)
`

/** Listagens admin / selects de venda e estoque — sem imagens */
const PRODUCT_ADMIN_LIST_SELECT = `
  id, category_id, name, slug, sku, price, promotional_price, status, featured, is_new, created_at, updated_at,
  category:categories(id, name, slug),
  product_variants(id, size_label, sku, quantity, active, display_order)
`

export async function listPublicProducts(filters: Partial<CatalogFilters> = {}) {
  let query = supabase
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .eq('status', 'active')

  if (filters.sort === 'price_asc') query = query.order('price', { ascending: true })
  else if (filters.sort === 'price_desc') query = query.order('price', { ascending: false })
  else if (filters.sort === 'name') query = query.order('name', { ascending: true })
  else query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error

  let products = (data ?? []).map((row) => mapProduct(row as never))

  if (filters.categorySlug) {
    products = products.filter((product) => product.category?.slug === filters.categorySlug)
  }

  if (filters.search) {
    const term = filters.search.toLowerCase()
    products = products.filter((product) =>
      [product.name, product.category?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    )
  }

  if (filters.size) {
    products = products.filter((product) =>
      product.variants.some((variant) => variant.active && variant.size_label === filters.size),
    )
  }

  if (filters.availability === 'in_stock') {
    products = products.filter((product) =>
      product.variants.some((variant) => variant.active && (variant.in_stock ?? variant.quantity > 0)),
    )
  }

  if (filters.minPrice) {
    const min = Number(filters.minPrice)
    products = products.filter((product) => Number(product.promotional_price ?? product.price) >= min)
  }

  if (filters.maxPrice) {
    const max = Number(filters.maxPrice)
    products = products.filter((product) => Number(product.promotional_price ?? product.price) <= max)
  }

  return products
}

export async function getFeaturedProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .eq('status', 'active')
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as never))
}

export async function getRecentProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) throw error
  return (data ?? []).map((row) => mapProduct(row as never))
}

export async function getPublicProduct(idOrSlug: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug)

  let query = supabase.from('products').select(PRODUCT_DETAIL_SELECT).eq('status', 'active')
  query = isUuid ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data ? mapProduct(data as never) : null
}

export async function listAdminProducts(status?: string) {
  let query = supabase.from('products').select(PRODUCT_ADMIN_LIST_SELECT).order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => mapProduct(row as never))
}

export async function getAdminProduct(id: string) {
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? mapProduct(data as never) : null
}

export interface ProductPayload {
  name: string
  category_id: string | null
  description: string
  additional_info: string
  sku: string
  price: number
  promotional_price: number | null
  status: Product['status']
  featured: boolean
  is_new: boolean
}

export async function createProduct(payload: ProductPayload): Promise<{ id: string }> {
  const slug = await uniqueSlug(payload.name)
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...payload,
      sku: payload.sku || null,
      promotional_price: payload.promotional_price,
      slug,
    })
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('products')
    .update({
      ...payload,
      sku: payload.sku || null,
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error) throw error
  return data
}

export async function archiveProduct(id: string) {
  const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', id)
  if (error) throw error
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      throw new Error('Produto já teve vendas ou movimentos de estoque. Prefira Arquivar.')
    }
    throw error
  }
}

export async function duplicateProduct(productId: string) {
  const product = await getAdminProduct(productId)
  if (!product) throw new Error('Produto não encontrado.')

  const copy = await createProduct({
    name: `${product.name} (cópia)`,
    category_id: product.category_id,
    description: product.description ?? '',
    additional_info: product.additional_info ?? '',
    sku: product.sku ? `${product.sku}-COPY` : '',
    price: product.price,
    promotional_price: product.promotional_price,
    status: 'draft',
    featured: false,
    is_new: true,
  })

  if (product.variants.length) {
    const { error } = await supabase.from('product_variants').insert(
      product.variants.map((variant) => ({
        product_id: copy.id,
        size_label: variant.size_label,
        sku: variant.sku,
        quantity: 0,
        active: variant.active,
        display_order: variant.display_order,
      })),
    )
    if (error) throw error
  }

  return copy
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || `produto-${Date.now()}`
  const { data } = await supabase.from('products').select('slug').like('slug', `${base}%`)
  const existing = new Set((data ?? []).map((row) => row.slug))
  if (!existing.has(base)) return base
  let i = 2
  while (existing.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

export async function upsertVariants(
  productId: string,
  variants: { id?: string; size_label: string; sku: string; quantity: number; active: boolean; display_order: number }[],
) {
  const existing = await supabase.from('product_variants').select('id, quantity').eq('product_id', productId)
  if (existing.error) throw existing.error

  const currentById = new Map((existing.data ?? []).map((row) => [row.id, Number(row.quantity ?? 0)]))
  const keepIds = variants.map((variant) => variant.id).filter(Boolean) as string[]
  const toDelete = (existing.data ?? []).filter((row) => !keepIds.includes(row.id)).map((row) => row.id)

  if (toDelete.length) {
    const { error } = await supabase.from('product_variants').delete().in('id', toDelete)
    if (error) throw error
  }

  const toUpdate = variants.filter((variant) => variant.id)
  const toInsert = variants.filter((variant) => !variant.id)

  await Promise.all(
    toUpdate.map(async (variant) => {
      const { error } = await supabase
        .from('product_variants')
        .update({
          size_label: variant.size_label,
          sku: variant.sku || null,
          active: variant.active,
          display_order: variant.display_order,
        })
        .eq('id', variant.id!)
      if (error) throw error

      const nextQuantity = Math.max(0, variant.quantity)
      const previousQuantity = currentById.get(variant.id!)
      if (previousQuantity !== undefined && previousQuantity !== nextQuantity) {
        const { error: stockError } = await supabase.rpc('adjust_stock', {
          p_variant_id: variant.id!,
          p_type: 'ajuste',
          p_quantity: nextQuantity,
          p_reason: 'Ajuste pelo cadastro do produto',
        })
        if (stockError) throw stockError
      }
    }),
  )

  if (toInsert.length) {
    const { error } = await supabase.from('product_variants').insert(
      toInsert.map((variant) => ({
        product_id: productId,
        size_label: variant.size_label,
        sku: variant.sku || null,
        quantity: Math.max(0, variant.quantity),
        active: variant.active,
        display_order: variant.display_order,
      })),
    )
    if (error) throw error
  }
}

export async function listProductImages(productId: string) {
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('display_order')
  if (error) throw error
  return data ?? []
}

export async function addProductImage(image: Omit<ProductImage, 'id' | 'created_at'>) {
  const { data, error } = await supabase.from('product_images').insert(image).select('*').single()
  if (error) throw error
  return data
}

export async function addProductImages(images: Omit<ProductImage, 'id' | 'created_at'>[]) {
  if (!images.length) return []
  const { data, error } = await supabase.from('product_images').insert(images).select('*')
  if (error) throw error
  return data ?? []
}

export async function deleteProductImage(id: string) {
  const { error } = await supabase.from('product_images').delete().eq('id', id)
  if (error) throw error
}

export async function updateImageOrder(images: { id: string; display_order: number; is_primary: boolean }[]) {
  await Promise.all(
    images.map(async (image) => {
      const { error } = await supabase
        .from('product_images')
        .update({ display_order: image.display_order, is_primary: image.is_primary })
        .eq('id', image.id)
      if (error) throw error
    }),
  )
}
