import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import { createCategory, deleteCategory, listAdminCategories, updateCategory } from '@/services/categories.service'
import type { Category } from '@/types'

function CategoryDescriptionField({ item }: { item: Category }) {
  const [description, setDescription] = useState(item.description ?? '')

  useEffect(() => {
    setDescription(item.description ?? '')
  }, [item.id, item.description])

  return (
    <Textarea
      className="mt-3"
      value={description}
      onChange={(event) => setDescription(event.target.value)}
      onBlur={async (event) => {
        const next = event.target.value
        if (next === (item.description ?? '')) return
        await updateCategory(item.id, {
          name: item.name,
          description: next,
          active: item.active,
          display_order: item.display_order,
        })
      }}
    />
  )
}

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState<Category | null>(null)

  async function load() {
    setItems(await listAdminCategories())
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div>
      <Seo title="Categorias" />
      <h1 className="font-display text-3xl">Categorias</h1>
      <form
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault()
          await createCategory({ name, description, active: true })
          toast.success('Categoria criada.')
          setName('')
          setDescription('')
          void load()
        }}
      >
        <Field label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Descrição">
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Button className="self-end">Adicionar</Button>
      </form>

      <div className="mt-6 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong>{item.name}</strong>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await updateCategory(item.id, {
                      name: item.name,
                      description: item.description ?? '',
                      active: !item.active,
                      display_order: item.display_order,
                    })
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
            <CategoryDescriptionField item={item} />
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Excluir categoria"
        description="Tem certeza que deseja excluir esta categoria?"
        danger
        confirmLabel="Excluir"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return
          await deleteCategory(pending.id)
          toast.success('Categoria excluída.')
          setPending(null)
          void load()
        }}
      />
    </div>
  )
}
