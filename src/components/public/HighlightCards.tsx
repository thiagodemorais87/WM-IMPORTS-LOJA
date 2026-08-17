import { MapPin, MessageCircle, Package, Shirt, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { StoreHighlight } from '@/types'
import { FadeIn, SpotlightCard } from '@/components/bits/Motion'

const icons: Record<string, LucideIcon> = {
  Truck,
  MessageCircle,
  Shirt,
  MapPin,
  Package,
}

export function HighlightCards({ highlights }: { highlights: StoreHighlight[] }) {
  if (!highlights.length) return null

  return (
    <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
      {highlights.map((item, index) => {
        const Icon = icons[item.icon] ?? Package
        return (
          <FadeIn key={item.id} delay={index * 0.08}>
            <SpotlightCard className="h-full p-5">
              <Icon className="mb-4 text-metal-300" size={22} />
              <h2 className="font-display text-lg text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-metal-400">{item.description}</p>
            </SpotlightCard>
          </FadeIn>
        )
      })}
    </section>
  )
}
