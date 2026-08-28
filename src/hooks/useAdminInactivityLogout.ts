import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ADMIN_SESSION_INACTIVITY_MS } from '@/constants'
import { useAuth } from '@/contexts/AuthContext'

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const

export function useAdminInactivityLogout() {
  const { logout, session, isAdmin } = useAuth()
  const navigate = useNavigate()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!session || !isAdmin) return

    function resetTimer() {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void logout().then(() => {
          navigate('/admin/login', { replace: true })
        })
      }, ADMIN_SESSION_INACTIVITY_MS)
    }

    function onActivity() {
      resetTimer()
    }

    resetTimer()
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity)
      }
    }
  }, [session, isAdmin, logout, navigate])
}
