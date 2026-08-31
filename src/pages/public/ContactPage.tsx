import { MapPin, MessageCircle } from 'lucide-react'
import { InstagramIcon } from '@/components/ui/InstagramIcon'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { useSettings } from '@/contexts/SettingsContext'
import { buildWhatsAppLink, instagramUrl } from '@/lib/whatsapp'

export function ContactPage() {
  const settings = useSettings()
  const wa = buildWhatsAppLink(settings?.whatsapp, `Olá! Gostaria de falar com a ${settings?.store_name ?? 'WM Imports'}.`)
  const ig = instagramUrl(settings?.instagram)

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Seo
        title="Contato"
        path="/contato"
        description="Fale com a WM Imports pelo WhatsApp. Consulte disponibilidade, valores e condições de envio de Sertânia/PE."
      />
      <p className="text-xs uppercase tracking-[0.3em] text-metal-500">Fale com a loja</p>
      <h1 className="mt-3 font-display text-4xl">Contato</h1>
      <p className="mt-4 text-metal-400">
        Escolha seus produtos e fale diretamente com a WM Imports pelo WhatsApp para consultar disponibilidade, valor e condições de envio.
      </p>
      <div className="mt-10 space-y-5 rounded-3xl border border-white/10 bg-panel p-6">
        <p className="flex items-start gap-3 text-metal-200">
          <MapPin className="mt-0.5" size={18} />
          WM Imports — {settings?.city ?? 'Sertânia'}/{settings?.state ?? 'PE'}
          {settings?.address ? <span className="block text-sm text-metal-400">{settings.address}</span> : null}
        </p>
        {settings?.business_hours ? <p className="text-metal-300">{settings.business_hours}</p> : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer">
            <Button variant="whatsapp">
              <MessageCircle size={18} /> WhatsApp
            </Button>
          </a>
        ) : (
          <p className="text-sm text-metal-500">Número de WhatsApp configurável no painel administrativo.</p>
        )}
        {ig ? (
          <a href={ig} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-metal-300 hover:text-white">
            <InstagramIcon size={18} /> Instagram
          </a>
        ) : null}
      </div>
    </div>
  )
}
