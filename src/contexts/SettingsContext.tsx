import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { StoreSettings } from '@/types'
import { getStoreSettings } from '@/services/settings.service'

const SettingsContext = createContext<StoreSettings | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null)

  useEffect(() => {
    getStoreSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
  }, [])

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}
