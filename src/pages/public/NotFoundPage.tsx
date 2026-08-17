import { Link } from 'react-router-dom'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <Seo title="Página não encontrada" />
      <p className="text-xs tracking-[0.3em] text-metal-500">404</p>
      <h1 className="mt-3 font-display text-4xl">Página não encontrada</h1>
      <p className="mt-3 text-metal-400">O endereço acessado não existe nesta loja.</p>
      <Link to="/" className="mt-8 inline-block">
        <Button>Voltar ao início</Button>
      </Link>
    </div>
  )
}
