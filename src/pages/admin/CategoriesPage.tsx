import { GripVertical } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { ConfirmDialog } from '@/components/ui/Modal'
import {
  createCategory,
  deleteCategory,
  listAdminCategories,
  updateCategory,
  updateCategoryOrder,
} from '@/services/categories.service'
import type { Category } from '@/types'

function CategoryNameField({ item, onSaved }: { item: Category; onSaved: () => void }) {
  const [name, setName] = useState(item.name)

  useEffect(() => {
    setName(item.name)
  }, [item.id, item.name])

  return (
    <Input
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={async (event) => {
        const next = event.target.value.trim()
        if (!next || next === item.name) {
          setName(item.name)
          return
        }
        try {
          await updateCategory(item.id, {
            name: next,
            description: item.description ?? '',
            active: item.active,
            display_order: item.display_order,
          })
          toast.success('Nome atualizado.')
          onSaved()
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o nome.')
          setName(item.name)
        }
      }}
    />
  )
}

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
        try {
          await updateCategory(item.id, {
            name: item.name,
            description: next,
            active: item.active,
            display_order: item.display_order,
          })
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a descrição.')
        }
      }}
    />
  )
}

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState<Category | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const droppingRef = useRef(false)

  async function load() {
    setItems(await listAdminCategories())
  }

  useEffect(() => {
    void load()
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
      await updateCategoryOrder(orderedIds)
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
      <Seo title="Categorias" robots="noindex, nofollow" />
      <h1 className="font-display text-3xl">Categorias</h1>
      <p className="mt-2 text-sm text-metal-400">Arraste para reordenar. A ordem aparece no catálogo e na home.</p>
      <form
        className="mt-6 grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (event) => {
          event.preventDefault()
          try {
            await createCategory({ name, description, active: true, display_order: items.length + 1 })
            toast.success('Categoria criada.')
            setName('')
            setDescription('')
            void load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível criar a categoria.')
          }
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
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDraggingId(item.id)}
            onDragOver={(event) => onDragOver(event, item.id)}
            onDrop={(event) => {
              event.preventDefault()
              void onDrop()
            }}
            onDragEnd={onDragEnd}
            className={cn(
              'rounded-2xl border border-white/10 p-4',
              draggingId === item.id && 'border-metal-300/60 opacity-60',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <button
                  type="button"
                  className="mt-2 cursor-grab text-metal-400 active:cursor-grabbing"
                  aria-label="Arrastar categoria"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <GripVertical size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <span className="mb-2 inline-block rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] text-metal-300">
                    {index + 1}
                  </span>
                  <CategoryNameField item={item} onSaved={load} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await updateCategory(item.id, {
                        name: item.name,
                        description: item.description ?? '',
                        active: !item.active,
                        display_order: item.display_order,
                      })
                      void load()
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a categoria.')
                    }
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
          try {
            await deleteCategory(pending.id)
            toast.success('Categoria excluída.')
            setPending(null)
            void load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a categoria.')
          }
        }}
      />
    </div>
  )
}
