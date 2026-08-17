import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Banner } from '@/types'
import { Button } from '@/components/ui/Button'
import { ShinyText } from '@/components/bits/Motion'
import { useSettings } from '@/contexts/SettingsContext'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import logo from '@/assets/logo.png'

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const settings = useSettings()
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6500, stopOnInteraction: false, stopOnMouseEnter: true }),
  ])
  const [index, setIndex] = useState(0)

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setIndex(emblaApi.selectedScrollSnap())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    onSelect()
  }, [emblaApi, onSelect])

  const wa = buildWhatsAppLink(settings?.whatsapp, `Olá! Gostaria de falar com a ${settings?.store_name ?? 'WM Imports'}.`)

  if (!banners.length) return null

  return (
    <section className="relative overflow-hidden border-b border-white/10">
      <div className="hero-grid absolute inset-0 opacity-40" />
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {banners.map((banner) => {
            const isWhatsapp = banner.button_link === 'whatsapp'
            const href = isWhatsapp ? wa : banner.button_link || '/produtos'
            return (
              <div key={banner.id} className="relative min-w-0 flex-[0_0_100%]">
                <div className="relative mx-auto grid min-h-[78vh] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:min-h-[82vh]">
                  {banner.image_url ? (
                    <img src={banner.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
                  ) : null}
                  <div className="relative space-y-6">
                    <p className="text-xs uppercase tracking-[0.35em] text-metal-400">
                      {banner.extra_text || 'Sertânia/PE • Enviamos para todo o Brasil'}
                    </p>
                    <h1 className="font-display text-4xl leading-[1.05] sm:text-6xl lg:text-7xl">
                      <ShinyText text={banner.title} />
                    </h1>
                    {banner.subtitle ? (
                      <p className="max-w-xl text-base text-metal-300 sm:text-lg">{banner.subtitle}</p>
                    ) : null}
                    {href ? (
                      isWhatsapp ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          <Button size="lg">{banner.button_text || 'Falar no WhatsApp'}</Button>
                        </a>
                      ) : (
                        <Link to={href}>
                          <Button size="lg">{banner.button_text || 'Ver produtos'}</Button>
                        </Link>
                      )
                    ) : null}
                  </div>
                  <div className="relative hidden justify-center lg:flex">
                    <div className="absolute inset-12 rounded-full bg-metal-300/10 blur-3xl" />
                    <img src={logo} alt="WM Imports" className="relative w-[min(420px,100%)] drop-shadow-2xl" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex gap-2">
          {banners.map((banner, bannerIndex) => (
            <button
              key={banner.id}
              aria-label={`Ir para banner ${bannerIndex + 1}`}
              onClick={() => emblaApi?.scrollTo(bannerIndex)}
              className={`h-1.5 rounded-full transition ${bannerIndex === index ? 'w-8 bg-metal-200' : 'w-3 bg-white/25'}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button aria-label="Anterior" onClick={() => emblaApi?.scrollPrev()} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40">
            <ChevronLeft size={18} />
          </button>
          <button aria-label="Próximo" onClick={() => emblaApi?.scrollNext()} className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/40">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}
