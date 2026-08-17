import { cn } from '@/lib/cn'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-metal-200">{label}</span>
      {children}
      {hint ? <span className="text-xs text-metal-500">{hint}</span> : null}
    </label>
  )
}

const controlClass =
  'w-full rounded-xl border border-line bg-ink-soft px-3 py-2.5 text-sm text-metal-50 placeholder:text-metal-500 outline-none transition focus:border-metal-300'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlClass, 'min-h-28 resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, className)} {...props}>
      {children}
    </select>
  )
}
