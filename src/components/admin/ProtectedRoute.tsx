import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { PageLoader } from '@/components/ui/Spinner'

export function ProtectedRoute() {
  const { loading, session, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
