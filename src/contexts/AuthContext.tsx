import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshAuth = useCallback(async () => {
    const nextSession = await getSession()
    setSession(nextSession)

    if (nextSession?.user) {
      const nextProfile = await ensureProfile(nextSession.user)
      setProfile(nextProfile)
    } else {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    refreshAuth().finally(() => setLoading(false))
    return onAuthChange(() => {
      void refreshAuth()
    })
  }, [refreshAuth])

  const isAdmin = profile?.role === 'admin'

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isAdmin,
      login: async (email, password) => {
        await signIn(email, password)
        await refreshAuth()
      },
      logout: async () => {
        await signOut()
        setSession(null)
        setProfile(null)
      },
      refreshAuth,
    }),
    [session, profile, loading, isAdmin, refreshAuth],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
