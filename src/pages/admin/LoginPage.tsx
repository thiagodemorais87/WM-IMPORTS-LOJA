import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/contexts/AuthContext'
import {
  clearLoginLock,
  formatRetryAfter,
  getLoginLockState,
  recordLoginFailure,
} from '@/lib/admin-login-rate-limit'
import { safeAdminRedirect } from '@/lib/safe-url'
import { ADMIN_LOGIN_MAX_ATTEMPTS } from '@/constants'
import logo from '@/assets/logo.png'

export function LoginPage() {
  const { login, session, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lockState, setLockState] = useState(() => getLoginLockState(''))
  const from = safeAdminRedirect((location.state as { from?: string } | null)?.from)

  useEffect(() => {
    setLockState(getLoginLockState(email))
  }, [email])

  useEffect(() => {
    if (!lockState.locked) return
    const timer = window.setInterval(() => {
      setLockState(getLoginLockState(email))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [email, lockState.locked])

  if (!loading && session && isAdmin) {
    return <Navigate to={from} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const currentLock = getLoginLockState(email)
    if (currentLock.locked) {
      toast.error(`Acesso bloqueado neste navegador. Tente novamente em ${formatRetryAfter(currentLock.retryAfterMs)}.`)
      setLockState(currentLock)
      return
    }

    setSubmitting(true)
    try {
      await login(email, password)
      clearLoginLock(email)
      setLockState(getLoginLockState(email))
      toast.success('Bem-vindo à WM Imports.')
      navigate(from, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível entrar.'
      const isRateLimited = message.includes('Muitas tentativas. Aguarde')

      if (isRateLimited) {
        toast.error(message)
      } else {
        const nextLock = recordLoginFailure(email)
        setLockState(nextLock)
        if (nextLock.locked) {
          toast.error(`Muitas tentativas. Bloqueado por ${formatRetryAfter(nextLock.retryAfterMs)} neste navegador.`)
        } else {
          toast.error(`E-mail ou senha incorretos. ${nextLock.attemptsRemaining} tentativa(s) restante(s).`)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4">
      <Seo title="Login administrativo" robots="noindex, nofollow" />
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-panel p-8">
        <img src={logo} alt="WM Imports" className="mx-auto h-16" />
        <h1 className="mt-6 text-center font-display text-2xl">Painel administrativo</h1>
        <p className="mt-2 text-center text-sm text-metal-400">Acesso exclusivo do proprietário da loja.</p>
        {!loading && session && !isAdmin ? (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-sm text-amber-200">
            Esta conta não tem permissão de administrador. Use o usuário promovido via bootstrap_admin.sql.
          </p>
        ) : null}
        {lockState.locked ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
            Acesso bloqueado neste navegador. Tente novamente em {formatRetryAfter(lockState.retryAfterMs)}.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="E-mail">
            <Input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Senha">
            <Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <p className="text-xs text-metal-500">
            Após {ADMIN_LOGIN_MAX_ATTEMPTS} tentativas incorretas, o acesso fica bloqueado por 15 minutos neste navegador.
          </p>
          <Button type="submit" className="w-full" disabled={submitting || lockState.locked}>
            {submitting ? 'Entrando...' : lockState.locked ? 'Acesso bloqueado' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  )
}
