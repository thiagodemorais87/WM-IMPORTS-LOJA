import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Banner } from '@/types'
import { Button } from '@/components/ui/Button'
import { ShinyText } from '@/components/bits/Motion'
import { useSettings } from '@/contexts/SettingsContext'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { isSafeBannerLink } from '@/lib/safe-url'
import logo from '@/assets/logo.png'

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const settings = useSettings()
  const reduced = useReducedMotion()
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
          {banners.map((banner, bannerIndex) => {
            const isWhatsapp = banner.button_link === 'whatsapp'
            const rawLink = banner.button_link || '/produtos'
            const href = isWhatsapp
              ? wa
              : isSafeBannerLink(rawLink)
                ? rawLink
                : '/produtos'
            const isExternal = Boolean(href && /^https?:\/\//i.test(href))
            const isActive = bannerIndex === index
            const heroImage = banner.image_url || logo
            return (
              <div key={banner.id} className="relative min-w-0 flex-[0_0_100%]">
                <div className="relative mx-auto grid min-h-0 max-w-7xl items-center gap-6 px-4 py-10 pb-20 sm:gap-8 sm:px-6 sm:py-14 sm:pb-24 lg:grid-cols-[1.1fr_0.9fr] lg:min-h-[82vh] lg:gap-10 lg:py-16 lg:pb-16">
                  {!reduced ? (
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
                    >
                      <motion.div
                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-metal-200/25 to-transparent"
                        initial={{ x: '-40%' }}
                        animate={{ x: '140%' }}
                        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
                      />
                    </motion.div>
                  ) : null}
                  <div className="relative z-10 space-y-4 sm:space-y-6">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-metal-400 sm:text-xs">
                      {banner.extra_text || 'Sertânia/PE • Enviamos para todo o Brasil'}
                    </p>
                    <h1 className="font-display text-3xl leading-[1.05] sm:text-5xl lg:text-7xl">
                      <ShinyText text={banner.title} />
                    </h1>
                    {banner.subtitle ? (
                      <p className="max-w-xl text-sm text-metal-300 sm:text-lg">{banner.subtitle}</p>
                    ) : null}
                    {href ? (
                      isWhatsapp || isExternal ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          <Button size="lg">{banner.button_text || (isWhatsapp ? 'Falar no WhatsApp' : 'Ver produtos')}</Button>
                        </a>
                      ) : (
                        <Link to={href}>
                          <Button size="lg">{banner.button_text || 'Ver produtos'}</Button>
                        </Link>
                      )
                    ) : null}
                  </div>
                  <div className="relative z-10 flex justify-center">
                    <div className="absolute inset-8 rounded-full bg-metal-300/10 blur-3xl sm:inset-12" />
                    <img
                      src={heroImage}
                      alt="WM Imports"
                      decoding="async"
                      loading={isActive || bannerIndex === 0 ? 'eager' : 'lazy'}
                      className="relative w-[min(220px,70%)] bg-transparent object-contain drop-shadow-2xl sm:w-[min(320px,80%)] lg:w-[min(420px,100%)]"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 z-10 mx-auto flex max-w-7xl items-center justify-between px-4 sm:bottom-6 sm:px-6">
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
