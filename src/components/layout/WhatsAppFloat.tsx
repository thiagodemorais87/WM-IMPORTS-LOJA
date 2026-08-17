import { MessageCircle } from 'lucide-react'
import { useSettings } from '@/contexts/SettingsContext'
import { buildWhatsAppLink } from '@/lib/whatsapp'

export function WhatsAppFloat() {
  const settings = useSettings()
  const href = buildWhatsAppLink(
    settings?.whatsapp,
    `Olá! Gostaria de falar com a ${settings?.store_name ?? 'WM Imports'}.`,
  )
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-ink shadow-lg shadow-black/40 transition hover:scale-105"
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle size={26} />
    </a>
  )
}
