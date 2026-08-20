import { useState } from 'react'
import { AppRouter } from '@/routes'
import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { SplashScreen, shouldShowSplash } from '@/components/public/SplashScreen'

export default function App() {
  const [showSplash, setShowSplash] = useState(() => shouldShowSplash())

  return (
    <AuthProvider>
      <SettingsProvider>
        <CartProvider>
          {showSplash ? <SplashScreen onDone={() => setShowSplash(false)} /> : null}
          <AppRouter />
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
