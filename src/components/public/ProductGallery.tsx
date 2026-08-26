import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProductImage } from '@/types'

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const ordered = [...images].sort((a, b) => a.display_order - b.display_order)
  const initialIndex = (() => {
    const primary = ordered.findIndex((image) => image.is_primary)
    return primary >= 0 ? primary : 0
  })()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const current = ordered[currentIndex] ?? ordered[0]
  const hasMultiple = ordered.length > 1

  const goTo = useCallback(
    (index: number) => {
      if (!ordered.length) return
      const next = ((index % ordered.length) + ordered.length) % ordered.length
      setCurrentIndex(next)
    },
    [ordered.length],
  )

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo])
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo])

  useEffect(() => {
    if (!hasMultiple) return
    const next = ordered[(currentIndex + 1) % ordered.length]
    if (!next?.url) return
    const prefetch = new Image()
    prefetch.src = next.url
  }, [currentIndex, hasMultiple, ordered])

  if (!ordered.length) {
    return <div className="grid aspect-square place-items-center rounded-2xl bg-panel text-metal-500">Sem imagens</div>
  }

  return (
    <div
      className="space-y-3"
      tabIndex={hasMultiple ? 0 : undefined}
      role={hasMultiple ? 'region' : undefined}
      aria-label={hasMultiple ? `Galeria de ${name}` : undefined}
      onKeyDown={(event) => {
        if (!hasMultiple) return
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          goPrev()
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          goNext()
        }
      }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-panel">
        <img
          src={current.url}
          alt={current.alt || name}
          decoding="async"
          loading="eager"
          className="aspect-square w-full object-cover"
        />
        {hasMultiple ? (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={goPrev}
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={goNext}
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              {ordered.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Ir para foto ${index + 1}`}
                  aria-current={index === currentIndex}
                  onClick={() => goTo(index)}
                  className={`h-2 rounded-full transition ${
                    index === currentIndex ? 'w-6 bg-metal-200' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {hasMultiple ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {ordered.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(index)}
              className={`overflow-hidden rounded-xl border ${
                index === currentIndex ? 'border-metal-300' : 'border-white/10'
              }`}
              aria-label={`Ver imagem ${image.alt || name}`}
            >
              <img src={image.url} alt="" decoding="async" loading="lazy" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
