import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Tone = 'metal' | 'success' | 'warning' | 'danger' | 'muted'

const tones: Record<Tone, string> = {
  metal: 'border-metal-500/30 bg-white/5 text-metal-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-300',
  muted: 'border-line bg-panel text-metal-400',
}

export function Badge({ children, tone = 'metal', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide', tones[tone], className)}>
      {children}
    </span>
  )
}
