import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { createHighlight, deleteHighlight, listAdminHighlights, updateHighlight } from '@/services/highlights.service'
import type { StoreHighlight } from '@/types'

export function HighlightsPage() {
  const [items, setItems] = useState<StoreHighlight[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('Package')

  async function load() {
    setItems(await listAdminHighlights())
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div>
      <Seo title="Diferenciais" />
      <h1 className="font-display text-3xl">Diferenciais</h1>
      <p className="mt-2 text-sm text-metal-400">Não cadastre condições que a loja ainda não oferece, como frete grátis.</p>
      <form
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 p-4"
        onSubmit={async (event) => {
          event.preventDefault()
          await createHighlight({ title, description, icon, active: true, display_order: items.length + 1 })
          toast.success('Diferencial criado.')
          setTitle('')
          setDescription('')
          void load()
        }}
      >
        <Field label="Título">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <Field label="Descrição">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field label="Ícone Lucide" hint="Truck, MessageCircle, Shirt, MapPin, Package">
          <Input value={icon} onChange={(event) => setIcon(event.target.value)} />
        </Field>
        <Button>Adicionar</Button>
      </form>
      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 p-4">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-metal-400">{item.description}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={async () => { await updateHighlight(item.id, { active: !item.active }); void load() }}>
                {item.active ? 'Desativar' : 'Ativar'}
              </Button>
              <Button size="sm" variant="danger" onClick={async () => { await deleteHighlight(item.id); toast.success('Removido.'); void load() }}>
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
