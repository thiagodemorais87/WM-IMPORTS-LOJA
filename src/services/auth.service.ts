import type { AuthError, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

export function mapAuthError(error: unknown): Error {
  if (!error || typeof error !== 'object') {
    return new Error('Não foi possível entrar.')
  }

  const authError = error as AuthError & { status?: number }
  const message = authError.message?.toLowerCase() ?? ''
  const status = authError.status

  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.')
  }

  if (
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    status === 400
  ) {
    return new Error('E-mail ou senha incorretos.')
  }

  return new Error(authError.message || 'Não foi possível entrar.')
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw mapAuthError(error)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

/** Garante perfil com role=none. Nunca promove a admin pelo client. */
export async function ensureProfile(user: User): Promise<Profile | null> {
  const existing = await getProfile(user.id)
  if (existing) return existing

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email ?? '',
      name: (user.user_metadata?.name as string | undefined) ?? user.email?.split('@')[0] ?? 'Usuário',
      role: 'none',
    })
    .select('*')
    .single()

  if (error) return getProfile(user.id)
  return data
}

export function onAuthChange(callback: () => void) {
  const { data } = supabase.auth.onAuthStateChange(() => {
    callback()
  })
  return data.subscription.unsubscribe
}
