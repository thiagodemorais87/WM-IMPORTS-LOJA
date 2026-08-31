import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import { getStoreSettings, updateStoreSettings } from '@/services/settings.service'
import { makeObjectPath, uploadImage } from '@/services/storage.service'
import type { StoreSettings } from '@/types'

export function SettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null)
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    getStoreSettings().then(setSettings).catch(() => toast.error('Não foi possível carregar as configurações.'))
  }, [])

  if (!settings) return <PageLoader />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    try {
      let logo_url = settings.logo_url
      if (file) {
        const uploaded = await uploadImage('store-assets', makeObjectPath('logo', file), file)
        logo_url = uploaded.url
      }
      const updated = await updateStoreSettings({ ...settings, logo_url })
      setSettings(updated)
      toast.success('Configurações salvas.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.')
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <Seo title="Configurações" robots="noindex, nofollow" />
      <h1 className="font-display text-3xl">Configurações da loja</h1>
      <Field label="Nome da loja">
        <Input value={settings.store_name} onChange={(event) => setSettings({ ...settings, store_name: event.target.value })} />
      </Field>
      <Field label="Slogan">
        <Input value={settings.tagline} onChange={(event) => setSettings({ ...settings, tagline: event.target.value })} />
      </Field>
      <Field label="Descrição">
        <Textarea value={settings.description ?? ''} onChange={(event) => setSettings({ ...settings, description: event.target.value })} />
      </Field>
      <Field label="WhatsApp" hint="DDD + número, com ou sem 55">
        <Input value={settings.whatsapp ?? ''} onChange={(event) => setSettings({ ...settings, whatsapp: event.target.value })} />
      </Field>
      <Field label="Instagram">
        <Input value={settings.instagram ?? ''} onChange={(event) => setSettings({ ...settings, instagram: event.target.value })} />
      </Field>
      <Field label="Endereço" hint="Opcional. Não invente se ainda não houver rua definida.">
        <Input value={settings.address ?? ''} onChange={(event) => setSettings({ ...settings, address: event.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cidade">
          <Input value={settings.city} onChange={(event) => setSettings({ ...settings, city: event.target.value })} />
        </Field>
        <Field label="Estado">
          <Input value={settings.state} onChange={(event) => setSettings({ ...settings, state: event.target.value })} />
        </Field>
      </div>
      <Field label="Horário de atendimento">
        <Input value={settings.business_hours ?? ''} onChange={(event) => setSettings({ ...settings, business_hours: event.target.value })} />
      </Field>
      <Field label="Limite de estoque baixo">
        <Input
          type="number"
          min="1"
          value={settings.low_stock_threshold}
          onChange={(event) => setSettings({ ...settings, low_stock_threshold: Number(event.target.value) })}
        />
      </Field>
      <Field label="Mensagem padrão do WhatsApp">
        <Textarea
          value={settings.whatsapp_message_template ?? ''}
          onChange={(event) => setSettings({ ...settings, whatsapp_message_template: event.target.value })}
        />
      </Field>
      <Field label="Logo">
        <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <Button>Salvar</Button>
    </form>
  )
}
