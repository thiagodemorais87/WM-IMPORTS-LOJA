import { Seo } from '@/components/ui/Seo'
import { useSettings } from '@/contexts/SettingsContext'
import logo from '@/assets/logo.png'

export function AboutPage() {
  const settings = useSettings()

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Seo
        title="Sobre"
        path="/sobre"
        description="Conheça a WM Imports, loja de moda em Sertânia/PE com envio para todo o Brasil."
      />
      <img src={logo} alt="WM Imports" className="h-20" />
      <p className="mt-8 text-xs uppercase tracking-[0.3em] text-metal-500">A loja</p>
      <h1 className="mt-3 font-display text-4xl">WM Imports</h1>
      <p className="mt-2 text-lg text-metal-300">De Sertânia para todo o Brasil.</p>
      <div className="mt-8 space-y-5 leading-relaxed text-metal-400">
        <p>
          {settings?.description ??
            'A WM Imports é uma loja de moda e acessórios com atuação em Sertânia, Pernambuco. O catálogo reúne camisas, polos, t-shirts, calças, óculos e outras peças selecionadas com foco em estilo, qualidade e praticidade.'}
        </p>
        <p>
          Atendemos clientes de todo o território nacional. A compra é simples: você escolhe o produto, consulta tamanho e disponibilidade e fala com a loja pelo WhatsApp para combinar pagamento e envio.
        </p>
        <p>
          WM Imports — {settings?.city ?? 'Sertânia'}/{settings?.state ?? 'PE'}. Enviamos para todo o Brasil.
        </p>
      </div>
    </div>
  )
}
