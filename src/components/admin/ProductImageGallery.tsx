import { GripVertical } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/cn'

export type GalleryItem =
  | { kind: 'saved'; id: string; url: string; storage_path: string; is_primary: boolean }
  | { kind: 'preview'; url: string; file: File }

function reorderGallery<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...list]
  const [item] = next.splice(fromIndex, 1)
  if (item === undefined) return list
  next.splice(toIndex, 0, item)
  return next
}

function itemKey(item: GalleryItem) {
  return item.kind === 'saved' ? item.id : item.url
}

export function ProductImageGallery({
  items,
  onChange,
  onRemove,
  onAddFiles,
}: {
  items: GalleryItem[]
  onChange: (items: GalleryItem[]) => void
  onRemove: (item: GalleryItem, index: number) => void | Promise<void>
  onAddFiles: (files: File[]) => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  function handleDragStart(index: number, event: DragEvent<HTMLDivElement>) {
    dragIndexRef.current = index
    setDragIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  function handleDragOver(index: number, event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const from = dragIndexRef.current
    if (from == null || from === index) return
    const next = reorderGallery(itemsRef.current, from, index)
    itemsRef.current = next
    onChange(next)
    dragIndexRef.current = index
    setDragIndex(index)
  }

  function clearDrag() {
    dragIndexRef.current = null
    setDragIndex(null)
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 p-5">
      <div>
        <h2 className="font-display text-lg">Imagens</h2>
        <p className="mt-1 text-xs text-metal-500">Arraste para reordenar. A primeira imagem é a capa da loja.</p>
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          if (files.length) onAddFiles(files)
          event.target.value = ''
        }}
      />
      {items.length ? (
        <div
          className="grid grid-cols-3 gap-3 sm:grid-cols-5"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            clearDrag()
          }}
        >
          {items.map((item, index) => (
            <div
              key={itemKey(item)}
              draggable
              onDragStart={(event) => handleDragStart(index, event)}
              onDragOver={(event) => handleDragOver(index, event)}
              onDrop={(event) => {
                event.preventDefault()
                clearDrag()
              }}
              onDragEnd={clearDrag}
              className={cn(
                'relative select-none rounded-xl',
                dragIndex === index && 'opacity-50 ring-2 ring-metal-300',
              )}
            >
              <div className="relative cursor-grab overflow-hidden rounded-xl active:cursor-grabbing">
                <img
                  src={item.url}
                  alt=""
                  draggable={false}
                  decoding="async"
                  loading={item.kind === 'saved' ? 'lazy' : undefined}
                  className="aspect-square w-full object-cover"
                />
                <span className="absolute left-1 top-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {index + 1}
                </span>
                <span className="absolute right-1 top-1 rounded-md bg-black/70 p-0.5 text-white" aria-hidden>
                  <GripVertical className="size-3.5" />
                </span>
                {index === 0 ? (
                  <span className="absolute bottom-1 left-1 rounded-md bg-metal-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                    Capa
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-1 text-[10px] text-red-300"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => void onRemove(item, index)}
              >
                {item.kind === 'saved' ? 'Excluir' : 'Remover'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-metal-500">Nenhuma imagem adicionada.</p>
      )}
    </section>
  )
}
