import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/contexts/AuthContext'
import logo from '@/assets/logo.png'

export function LoginPage() {
  const { login, session, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  if (!loading && session && isAdmin) {
    return <Navigate to="/admin" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
      toast.success('Bem-vindo à WM Imports.')
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível entrar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4">
      <Seo title="Login administrativo" />
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-panel p-8">
        <img src={logo} alt="WM Imports" className="mx-auto h-16" />
        <h1 className="mt-6 text-center font-display text-2xl">Painel administrativo</h1>
        <p className="mt-2 text-center text-sm text-metal-400">Acesso exclusivo do proprietário da loja.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="E-mail">
            <Input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Senha">
            <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
