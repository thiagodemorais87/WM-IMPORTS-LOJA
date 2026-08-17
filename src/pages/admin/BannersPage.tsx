import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { createBanner, deleteBanner, listAdminBanners, updateBanner } from '@/services/banners.service'
import { makeObjectPath, uploadImage } from '@/services/storage.service'
import { BANNER_TYPE_LABELS } from '@/constants'
import type { Banner, BannerType } from '@/types'

const empty = {
  title: '',
  subtitle: '',
  extra_text: '',
  button_text: 'Ver produtos',
  button_link: '/produtos',
  type: 'institutional' as BannerType,
  active: true,
}

export function BannersPage() {
  const [items, setItems] = useState<Banner[]>([])
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState<Banner | null>(null)

  async function load() {
    setItems(await listAdminBanners())
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div>
      <Seo title="Banners" />
      <h1 className="font-display text-3xl">Banners</h1>
      <p className="mt-2 text-sm text-metal-400">
        Use banners institucionais agora. Banners promocionais só devem ser ativados quando houver uma condição real.
      </p>

      <form
        className="mt-6 space-y-3 rounded-2xl border border-white/10 p-4"
        onSubmit={async (event) => {
          event.preventDefault()
          let image_url: string | undefined
          let storage_path: string | undefined
          if (file) {
            const path = makeObjectPath('banners', file)
            const uploaded = await uploadImage('store-assets', path, file)
            image_url = uploaded.url
            storage_path = uploaded.path
          }
          await createBanner({
            ...form,
            image_url,
            storage_path,
            display_order: items.length + 1,
          })
          toast.success('Banner criado.')
          setForm(empty)
          setFile(null)
          void load()
        }}
      >
        <Field label="Título">
          <Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </Field>
        <Field label="Subtítulo">
          <Textarea value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} />
        </Field>
        <Field label="Texto extra">
          <Input value={form.extra_text} onChange={(event) => setForm({ ...form, extra_text: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Botão">
            <Input value={form.button_text} onChange={(event) => setForm({ ...form, button_text: event.target.value })} />
          </Field>
          <Field label="Link" hint="Use /produtos ou whatsapp">
            <Input value={form.button_link} onChange={(event) => setForm({ ...form, button_link: event.target.value })} />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as BannerType })}>
              {Object.entries(BANNER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <Button>Criar banner</Button>
      </form>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-metal-500">{BANNER_TYPE_LABELS[item.type]} · ordem {item.display_order}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await updateBanner(item.id, { active: !item.active })
                    void load()
                  }}
                >
                  {item.active ? 'Desativar' : 'Ativar'}
                </Button>
                <Button size="sm" variant="danger" onClick={() => setPending(item)}>
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Excluir banner"
        description="Tem certeza que deseja excluir este banner?"
        danger
        confirmLabel="Excluir"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return
          await deleteBanner(pending.id)
          toast.success('Banner excluído.')
          setPending(null)
          void load()
        }}
      />
    </div>
  )
}
