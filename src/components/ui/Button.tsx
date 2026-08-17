import { cn } from '@/lib/cn'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-metal-100 to-metal-400 text-ink font-semibold shadow-[0_8px_24px_rgba(192,192,192,0.16)] hover:from-white hover:to-metal-300',
  secondary:
    'border border-metal-500/40 bg-panel text-metal-100 hover:border-metal-300 hover:text-white',
  ghost: 'text-metal-300 hover:text-white hover:bg-white/5',
  danger: 'bg-red-950/70 text-red-200 border border-red-900 hover:bg-red-900/80',
  whatsapp: 'bg-[#25D366] text-ink font-semibold hover:bg-[#34e072]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
