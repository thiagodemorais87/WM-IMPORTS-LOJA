import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Tone = 'metal' | 'success' | 'warning' | 'danger' | 'muted'

const tones: Record<Tone, string> = {
  metal: 'border-white/40 bg-zinc-900/90 text-white shadow-sm backdrop-blur-sm',
  success: 'border-emerald-400 bg-emerald-600 text-white shadow-sm',
  warning: 'border-amber-400 bg-amber-500 text-ink shadow-sm',
  danger: 'border-red-400 bg-red-600 text-white shadow-sm',
  muted: 'border-line bg-panel text-metal-300 shadow-sm',
}

export function Badge({ children, tone = 'metal', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide', tones[tone], className)}>
      {children}
    </span>
  )
}
