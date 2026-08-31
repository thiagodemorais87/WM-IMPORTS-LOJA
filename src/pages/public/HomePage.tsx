import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Seo } from '@/components/ui/Seo'
import { HeroCarousel } from '@/components/public/HeroCarousel'
import { HighlightCards } from '@/components/public/HighlightCards'
import { ProductCard } from '@/components/public/ProductCard'
import { Button } from '@/components/ui/Button'
import { ErrorState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Spinner'
import { FadeIn } from '@/components/bits/Motion'
import { listPublicBanners } from '@/services/banners.service'
import { listPublicHighlights } from '@/services/highlights.service'
import { listPublicCategories } from '@/services/categories.service'
import { getFeaturedProducts, getRecentProducts } from '@/services/products.service'
import { useSettings } from '@/contexts/SettingsContext'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import type { Banner, Category, ProductWithRelations, StoreHighlight } from '@/types'

export function HomePage() {
  const settings = useSettings()
  const [bannersLoading, setBannersLoading] = useState(true)
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [banners, setBanners] = useState<Banner[]>([])
  const [highlights, setHighlights] = useState<StoreHighlight[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [featured, setFeatured] = useState<ProductWithRelations[]>([])
  const [recent, setRecent] = useState<ProductWithRelations[]>([])

  function load() {
    setBannersLoading(true)
    setSectionsLoading(true)
    setError(null)

    void listPublicBanners()
      .then(setBanners)
      .catch(() => setError('Não foi possível carregar a loja.'))
      .finally(() => setBannersLoading(false))

    void Promise.all([
      listPublicHighlights(),
      listPublicCategories(),
      getFeaturedProducts(),
      getRecentProducts(),
    ])
      .then(([nextHighlights, nextCategories, nextFeatured, nextRecent]) => {
        setHighlights(nextHighlights)
        setCategories(nextCategories)
        setFeatured(nextFeatured)
        setRecent(nextRecent)
      })
      .catch(() => setError('Não foi possível carregar a loja.'))
      .finally(() => setSectionsLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const wa = buildWhatsAppLink(settings?.whatsapp, `Olá! Gostaria de falar com a ${settings?.store_name ?? 'WM Imports'}.`)

  return (
    <>
      <Seo
        title="Moda e Acessórios"
        path="/"
        description="WM Imports — moda, estilo e qualidade. Loja em Sertânia/PE com envio para todo o Brasil. Camisas, polos, t-shirts, calças e óculos."
      />
      {error ? (
        <div className="mx-auto max-w-7xl px-4 py-16">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : (
        <>
          {bannersLoading ? <Skeleton className="h-[70vh] rounded-none" /> : <HeroCarousel banners={banners} />}
          {sectionsLoading && !highlights.length ? null : <HighlightCards highlights={highlights} />}

          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <FadeIn>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-metal-500">Seleção</p>
                  <h2 className="mt-2 font-display text-3xl">Produtos em destaque</h2>
                </div>
                <Link to="/produtos" className="text-sm text-metal-300 hover:text-white">
                  Ver todos
                </Link>
              </div>
            </FadeIn>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {sectionsLoading
                ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="aspect-[3/4]" />)
                : featured.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h2 className="font-display text-3xl">Categorias</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {sectionsLoading
                ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
                : categories.map((category) => (
                    <Link
                      key={category.id}
                      to={`/produtos?categoria=${category.slug}`}
                      className="rounded-2xl border border-white/10 bg-panel px-4 py-6 text-center transition hover:border-metal-400/40"
                    >
                      <span className="font-display text-lg">{category.name}</span>
                    </Link>
                  ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <h2 className="font-display text-3xl">Produtos recentes</h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {sectionsLoading
                ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="aspect-[3/4]" />)
                : recent.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#1a1a1a] to-black px-6 py-14 text-center sm:px-12">
              <p className="text-xs uppercase tracking-[0.3em] text-metal-500">Atendimento</p>
              <h2 className="mt-3 font-display text-3xl sm:text-5xl">Seu estilo começa aqui.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-metal-400">
                Escolha seus produtos e fale com a WM Imports pelo WhatsApp para consultar disponibilidade, valor e condições de envio.
              </p>
              {wa ? (
                <a href={wa} target="_blank" rel="noreferrer" className="mt-8 inline-block">
                  <Button size="lg">Falar no WhatsApp</Button>
                </a>
              ) : (
                <p className="mt-6 text-sm text-metal-500">WhatsApp configurável no painel administrativo.</p>
              )}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-metal-500">Sobre</p>
                <h2 className="mt-3 font-display text-3xl">WM Imports — Sertânia/PE</h2>
                <p className="mt-4 max-w-xl leading-relaxed text-metal-400">
                  {settings?.description ??
                    'A WM Imports reúne moda, estilo e qualidade em um catálogo pensado para quem busca peças atuais com atendimento direto e humano.'}
                </p>
                <Link to="/sobre" className="mt-6 inline-block text-sm text-metal-200 hover:text-white">
                  Conhecer a loja →
                </Link>
              </div>
              <div className="rounded-3xl border border-white/10 bg-panel p-8">
                <h3 className="font-display text-2xl">📦 Enviamos para todo o Brasil</h3>
                <p className="mt-3 text-metal-400">
                  Estamos em Sertânia/PE e atendemos clientes de todo o país. Consulte disponibilidade, valor e condições de envio pelo WhatsApp.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  )
}
