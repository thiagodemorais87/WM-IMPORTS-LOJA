import { Link } from 'react-router-dom'
import { MapPin, MessageCircle } from 'lucide-react'
import { InstagramIcon } from '@/components/ui/InstagramIcon'
import { useSettings } from '@/contexts/SettingsContext'
import { buildWhatsAppLink, instagramUrl } from '@/lib/whatsapp'
import logo from '@/assets/logo.png'

export function Footer() {
  const settings = useSettings()
  const wa = buildWhatsAppLink(settings?.whatsapp, `Olá! Gostaria de falar com a ${settings?.store_name ?? 'WM Imports'}.`)
  const ig = instagramUrl(settings?.instagram)

  return (
    <footer className="border-t border-white/10 bg-ink-soft">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <img src={logo} alt="WM Imports" className="h-14 w-auto" />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-metal-400">
            {settings?.description ??
              'Moda, estilo e qualidade em um só lugar. A WM Imports está em Sertânia/PE e envia para todo o Brasil.'}
          </p>
          <p className="mt-4 text-sm text-metal-200">De Sertânia para todo o Brasil. 🇧🇷</p>
        </div>

        <div>
          <h2 className="font-display text-sm tracking-[0.2em] text-metal-300">LOJA</h2>
          <ul className="mt-4 space-y-2 text-sm text-metal-400">
            <li><Link to="/produtos" className="hover:text-white">Produtos</Link></li>
            <li><Link to="/sobre" className="hover:text-white">Sobre</Link></li>
            <li><Link to="/contato" className="hover:text-white">Contato</Link></li>
            <li><Link to="/carrinho" className="hover:text-white">Carrinho</Link></li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-sm tracking-[0.2em] text-metal-300">CONTATO</h2>
          <ul className="mt-4 space-y-3 text-sm text-metal-400">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="mt-0.5" />
              WM Imports — {settings?.city ?? 'Sertânia'}/{settings?.state ?? 'PE'}
            </li>
            {settings?.business_hours ? <li>{settings.business_hours}</li> : null}
            {wa ? (
              <li>
                <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </li>
            ) : null}
            {ig ? (
              <li>
                <a href={ig} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-white">
                  <InstagramIcon size={16} /> Instagram
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-metal-500">
        © {new Date().getFullYear()} WM Imports — Sertânia/PE. Enviamos para todo o Brasil.
      </div>
    </footer>
  )
}
