import { useState } from 'react'
import type { ProductImage } from '@/types'

export function ProductGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const ordered = [...images].sort((a, b) => a.display_order - b.display_order)
  const [current, setCurrent] = useState(ordered.find((image) => image.is_primary) ?? ordered[0])

  if (!ordered.length) {
    return <div className="grid aspect-square place-items-center rounded-2xl bg-panel text-metal-500">Sem imagens</div>
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel">
        <img
          src={current.url}
          alt={current.alt || name}
          decoding="async"
          loading="eager"
          className="aspect-square w-full object-cover"
        />
      </div>
      {ordered.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {ordered.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setCurrent(image)}
              className={`overflow-hidden rounded-xl border ${current.id === image.id ? 'border-metal-300' : 'border-white/10'}`}
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
