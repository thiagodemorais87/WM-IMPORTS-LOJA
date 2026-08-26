import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import {
  createBanner,
  deleteBanner,
  ensureDefaultBannerActive,
  getDefaultBannerId,
  isDefaultBanner,
  listAdminBanners,
  updateBanner,
  updateBannerOrder,
} from '@/services/banners.service'
import { makeObjectPath, removeImage, uploadImage, validateImageFile } from '@/services/storage.service'
import { compressImageFile } from '@/lib/image-compress'
import { BANNER_TYPE_LABELS } from '@/constants'
import type { Banner, BannerType } from '@/types'
import logo from '@/assets/logo.png'

const empty = {
  title: '',
  subtitle: '',
  extra_text: '',
  button_text: 'Ver produtos',
  button_link: '/produtos',
  type: 'institutional' as BannerType,
  active: true,
}

function BannerCard({
  item,
  all,
  draggingId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onReload,
  onRequestDelete,
}: {
  item: Banner
  all: Banner[]
  draggingId: string | null
  onDragStart: (id: string) => void
  onDragOver: (event: DragEvent, id: string) => void
  onDrop: (id: string) => void
  onDragEnd: () => void
  onReload: () => void
  onRequestDelete: (banner: Banner) => void
}) {
  const isDefault = isDefaultBanner(item, all)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(item.title)
  const [subtitle, setSubtitle] = useState(item.subtitle ?? '')
  const [extraText, setExtraText] = useState(item.extra_text ?? '')
  const [buttonText, setButtonText] = useState(item.button_text ?? '')
  const [buttonLink, setButtonLink] = useState(item.button_link ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(item.title)
    setSubtitle(item.subtitle ?? '')
    setExtraText(item.extra_text ?? '')
    setButtonText(item.button_text ?? '')
    setButtonLink(item.button_link ?? '')
  }, [item])

  async function saveFields(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateBanner(item.id, {
        title,
        subtitle: subtitle || null,
        extra_text: extraText || null,
        button_text: buttonText || null,
        button_link: buttonLink || null,
      })
      toast.success('Banner atualizado.')
      onReload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function onImageChange(file: File | null) {
    if (!file) return
    try {
      validateImageFile(file)
      const compressed = await compressImageFile(file)
      validateImageFile(compressed)
      const path = makeObjectPath('banners', compressed)
      const uploaded = await uploadImage('store-assets', path, compressed)
      if (item.storage_path) {
        await removeImage('store-assets', item.storage_path)
      }
      await updateBanner(item.id, { image_url: uploaded.url, storage_path: uploaded.path })
      toast.success('Imagem do banner atualizada.')
      onReload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.')
    }
  }

  async function resetToLogo() {
    try {
      if (item.storage_path) {
        await removeImage('store-assets', item.storage_path)
      }
      await updateBanner(item.id, { image_url: null, storage_path: null })
      toast.success('Usando logo padrão.')
      onReload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível restaurar a logo.')
    }
  }

  return (
    <div
      onDragOver={(event) => onDragOver(event, item.id)}
      onDrop={() => onDrop(item.id)}
      className={`rounded-2xl border border-white/10 p-4 transition ${
        draggingId === item.id ? 'border-metal-300/60 opacity-60' : ''
      }`}
    >
      <div className={`flex flex-wrap items-start justify-between gap-3 ${open ? 'mb-4' : ''}`}>
        <div className="flex items-start gap-3">
          <span
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move'
              onDragStart(item.id)
            }}
            onDragEnd={onDragEnd}
            className="mt-1 cursor-grab text-metal-500 active:cursor-grabbing"
            title="Arrastar para reordenar"
          >
            <GripVertical size={18} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{item.title}</p>
              {isDefault ? <Badge>Padrão</Badge> : null}
              <Badge tone={item.active ? 'success' : 'muted'}>{item.active ? 'Ativo' : 'Inativo'}</Badge>
            </div>
            <p className="text-xs text-metal-500">
              {BANNER_TYPE_LABELS[item.type]} · ordem {item.display_order}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" type="button" onClick={() => setOpen((value) => !value)}>
            {open ? (
              <>
                <ChevronUp size={16} /> Fechar
              </>
            ) : (
              <>
                <ChevronDown size={16} /> Editar
              </>
            )}
          </Button>
          {isDefault ? (
            <Button size="sm" variant="secondary" type="button" disabled title="O banner padrão permanece sempre ativo na home">
              Sempre ativo
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={async () => {
                try {
                  await updateBanner(item.id, { active: !item.active }, all)
                  onReload()
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Não foi possível alterar o status.')
                }
              }}
            >
              {item.active ? 'Desativar' : 'Ativar'}
            </Button>
          )}
          {!isDefault ? (
            <Button size="sm" variant="danger" type="button" onClick={() => onRequestDelete(item)}>
              Excluir
            </Button>
          ) : null}
        </div>
      </div>

      {open ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <img
              src={item.image_url || logo}
              alt=""
              className="h-20 w-20 rounded-xl border border-white/10 object-contain bg-ink"
            />
            <div className="space-y-2">
              <p className="text-xs text-metal-500">{item.image_url ? 'Imagem personalizada' : 'Logo padrão'}</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void onImageChange(event.target.files?.[0] ?? null)}
              />
              {item.image_url ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void resetToLogo()}>
                  Usar logo padrão
                </Button>
              ) : null}
            </div>
          </div>

          <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveFields}>
            <Field label="Título">
              <Input required value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Texto extra">
              <Input value={extraText} onChange={(event) => setExtraText(event.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Subtítulo">
                <Textarea value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
              </Field>
            </div>
            <Field label="Botão">
              <Input value={buttonText} onChange={(event) => setButtonText(event.target.value)} />
            </Field>
            <Field label="Link" hint="Use /produtos, whatsapp ou https://...">
              <Input value={buttonLink} onChange={(event) => setButtonLink(event.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar textos'}
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  )
}

export function BannersPage() {
  const [items, setItems] = useState<Banner[]>([])
  const [form, setForm] = useState(empty)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState<Banner | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const droppingRef = useRef(false)

  async function load() {
    const next = await listAdminBanners()
    await ensureDefaultBannerActive(next)
    setItems(await listAdminBanners())
  }

  useEffect(() => {
    void load().catch(() => toast.error('Não foi possível carregar os banners.'))
  }, [])

  function onDragOver(event: DragEvent, overId: string) {
    event.preventDefault()
    if (!draggingId || draggingId === overId) return
    setItems((current) => {
      const from = current.findIndex((item) => item.id === draggingId)
      const to = current.findIndex((item) => item.id === overId)
      if (from < 0 || to < 0 || from === to) return current
      const next = [...current]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function onDrop() {
    if (!draggingId || droppingRef.current) return
    droppingRef.current = true
    const orderedIds = itemsRef.current.map((item) => item.id)
    try {
      await updateBannerOrder(orderedIds)
      toast.success('Ordem atualizada.')
      await load()
    } catch {
      toast.error('Não foi possível salvar a ordem.')
      await load()
    } finally {
      setDraggingId(null)
      droppingRef.current = false
    }
  }

  function onDragEnd() {
    if (droppingRef.current) return
    setDraggingId(null)
    void load()
  }

  return (
    <div>
      <Seo title="Banners" />
      <h1 className="font-display text-3xl">Banners</h1>
      <p className="mt-2 text-sm text-metal-400">
        Arraste pelo ícone para reordenar. O banner padrão fica sempre ativo na home e não pode ser excluído.
      </p>

      <form
        className="mt-6 space-y-3 rounded-2xl border border-white/10 p-4"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            let image_url: string | undefined
            let storage_path: string | undefined
            if (file) {
              validateImageFile(file)
              const compressed = await compressImageFile(file)
              validateImageFile(compressed)
              const path = makeObjectPath('banners', compressed)
              const uploaded = await uploadImage('store-assets', path, compressed)
              image_url = uploaded.url
              storage_path = uploaded.path
            }
            await createBanner({
              ...form,
              image_url: image_url ?? null,
              storage_path: storage_path ?? null,
              display_order: items.length + 1,
            })
            toast.success('Banner criado.')
            setForm(empty)
            setFile(null)
            void load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível criar o banner.')
          }
        }}
      >
        <Field label="Título">
          <Input required value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
        </Field>
        <Field label="Subtítulo">
          <Textarea value={form.subtitle} onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))} />
        </Field>
        <Field label="Texto extra">
          <Input value={form.extra_text} onChange={(event) => setForm((prev) => ({ ...prev, extra_text: event.target.value }))} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Botão">
            <Input value={form.button_text} onChange={(event) => setForm((prev) => ({ ...prev, button_text: event.target.value }))} />
          </Field>
          <Field label="Link" hint="Use /produtos, whatsapp ou https://...">
            <Input value={form.button_link} onChange={(event) => setForm((prev) => ({ ...prev, button_link: event.target.value }))} />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as BannerType }))}>
              {Object.entries(BANNER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Imagem" hint="Opcional. Sem arquivo, usa a logo padrão na home.">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <Button>Criar banner</Button>
      </form>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <BannerCard
            key={item.id}
            item={item}
            all={items}
            draggingId={draggingId}
            onDragStart={setDraggingId}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onReload={() => void load()}
            onRequestDelete={setPending}
          />
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
          try {
            if (getDefaultBannerId(items) === pending.id) {
              throw new Error('O banner padrão não pode ser excluído.')
            }
            await deleteBanner(pending.id, items)
            toast.success('Banner excluído.')
            setPending(null)
            void load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível excluir.')
          }
        }}
      />
    </div>
  )
}
