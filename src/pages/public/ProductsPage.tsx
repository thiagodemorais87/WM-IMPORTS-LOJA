import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { Seo } from '@/components/ui/Seo'
import { ProductCard } from '@/components/public/ProductCard'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { Field, Input, Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Spinner'
import { listPublicProducts } from '@/services/products.service'
import { listPublicCategories } from '@/services/categories.service'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { DEFAULT_FILTERS } from '@/constants'
import type { CatalogFilters, Category, ProductWithRelations } from '@/types'

export function ProductsPage() {
  const [params, setParams] = useSearchParams()
  const [openFilters, setOpenFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filters, setFilters] = useState<CatalogFilters>({
    ...DEFAULT_FILTERS,
    search: params.get('q') ?? '',
    categorySlug: params.get('categoria') ?? '',
  })
  const debouncedSearch = useDebouncedValue(filters.search)

  useEffect(() => {
    listPublicCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    listPublicProducts({ ...filters, search: debouncedSearch })
      .then(setProducts)
      .catch(() => setError('Não foi possível carregar os produtos.'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, filters.categorySlug, filters.size, filters.availability, filters.minPrice, filters.maxPrice, filters.sort])

  useEffect(() => {
    const next = new URLSearchParams()
    if (filters.search) next.set('q', filters.search)
    if (filters.categorySlug) next.set('categoria', filters.categorySlug)
    setParams(next, { replace: true })
  }, [filters.search, filters.categorySlug, setParams])

  const sizes = useMemo(() => {
    const set = new Set<string>()
    products.forEach((product) => product.variants.forEach((variant) => set.add(variant.size_label)))
    return [...set]
  }, [products])

  const filterForm = (
    <div className="space-y-4">
      <Field label="Busca">
        <Input
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder="Nome ou categoria"
        />
      </Field>
      <Field label="Categoria">
        <Select
          value={filters.categorySlug}
          onChange={(event) => setFilters((current) => ({ ...current, categorySlug: event.target.value }))}
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tamanho">
        <Select value={filters.size} onChange={(event) => setFilters((current) => ({ ...current, size: event.target.value }))}>
          <option value="">Todos</option>
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Disponibilidade">
        <Select
          value={filters.availability}
          onChange={(event) =>
            setFilters((current) => ({ ...current, availability: event.target.value as CatalogFilters['availability'] }))
          }
        >
          <option value="all">Todas</option>
          <option value="in_stock">Disponíveis</option>
          <option value="out_of_stock">Esgotados</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Preço mín.">
          <Input
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={(event) => setFilters((current) => ({ ...current, minPrice: event.target.value }))}
          />
        </Field>
        <Field label="Preço máx.">
          <Input
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={(event) => setFilters((current) => ({ ...current, maxPrice: event.target.value }))}
          />
        </Field>
      </div>
      <Field label="Ordenar">
        <Select
          value={filters.sort}
          onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as CatalogFilters['sort'] }))}
        >
          <option value="recent">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="name">Nome</option>
        </Select>
      </Field>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Seo title="Produtos" description="Catálogo WM Imports — camisas, polos, t-shirts, calças e óculos." />
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-metal-500">Catálogo</p>
          <h1 className="mt-2 font-display text-4xl">Produtos</h1>
        </div>
        <Button variant="secondary" className="lg:hidden" onClick={() => setOpenFilters(true)}>
          <SlidersHorizontal size={16} /> Filtros
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">{filterForm}</aside>
        <div>
          {error ? (
            <ErrorState message={error} onRetry={() => setFilters((current) => ({ ...current }))} />
          ) : loading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[3/4]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <EmptyState title="Nenhum produto encontrado." description="Ajuste os filtros ou busque por outro termo." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {openFilters ? (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden">
          <div className="ml-auto h-full w-[min(100%,22rem)] overflow-y-auto bg-ink p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Filtros</h2>
              <button onClick={() => setOpenFilters(false)}>Fechar</button>
            </div>
            {filterForm}
            <Button className="mt-6 w-full" onClick={() => setOpenFilters(false)}>
              Ver resultados
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
