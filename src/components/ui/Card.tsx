import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('surface rounded-2xl p-5 shadow-[var(--shadow-card)]', className)}>{children}</div>
}
