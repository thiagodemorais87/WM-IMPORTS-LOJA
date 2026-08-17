import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
      <h2 className="font-display text-xl text-metal-100">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-metal-400">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Algo deu errado"
      description={message}
      action={onRetry ? <Button onClick={onRetry}>Tentar novamente</Button> : null}
    />
  )
}
