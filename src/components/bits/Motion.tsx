import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      animate={reduced ? { opacity: 1 } : undefined}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export function ShinyText({ text, className }: { text: string; className?: string }) {
  return <span className={`relative inline-block metal-text ${className ?? ''}`}>{text}</span>
}

export function CountUp({ value }: { value: number }) {
  const reduced = useReducedMotion()
  return (
    <motion.span
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {value.toLocaleString('pt-BR')}
    </motion.span>
  )
}

export function SpotlightCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-line bg-panel ${className ?? ''}`}>
      <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-metal-300/10 blur-3xl transition group-hover:bg-metal-300/20" />
      <div className="relative">{children}</div>
    </div>
  )
}
