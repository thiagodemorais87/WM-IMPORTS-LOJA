import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/types'
import { ensureProfile, getSession, onAuthChange, signIn, signOut } from '@/services/auth.service'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const nextSession = await getSession()
    setSession(nextSession)
    if (nextSession?.user) {
      const nextProfile = await ensureProfile(nextSession.user)
      setProfile(nextProfile)
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
    return onAuthChange(() => {
      void refresh()
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      login: async (email, password) => {
        await signIn(email, password)
        await refresh()
      },
      logout: async () => {
        await signOut()
        setSession(null)
        setProfile(null)
      },
    }),
    [session, profile, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
