import { AppRouter } from '@/routes'
import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { SettingsProvider } from '@/contexts/SettingsContext'

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <CartProvider>
          <AppRouter />
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
