import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ProductImageGallery, type GalleryItem } from '@/components/admin/ProductImageGallery'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import {
  addProductImages,
  createProduct,
  deleteProductImage,
  getAdminProduct,
  updateImageOrder,
  updateProduct,
  upsertVariants,
} from '@/services/products.service'
import { listAdminCategories } from '@/services/categories.service'
import { makeObjectPath, removeImage, uploadImage, validateImageFile } from '@/services/storage.service'
import { compressImageFile } from '@/lib/image-compress'
import { mapPool } from '@/lib/async'
import { MAX_PRODUCT_IMAGES } from '@/constants'
import type { Category, ProductStatus } from '@/types'

interface VariantDraft {
  id?: string
  size_label: string
  sku: string
  quantity: number
  active: boolean
  display_order: number
}

export function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('Salvar produto')
  const [categories, setCategories] = useState<Category[]>([])
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const galleryRef = useRef(gallery)
  galleryRef.current = gallery
  const [variants, setVariants] = useState<VariantDraft[]>([
    { size_label: 'M', sku: '', quantity: 0, active: true, display_order: 1 },
  ])
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    description: '',
    additional_info: '',
    price: '',
    promotional_price: '',
    status: 'draft' as ProductStatus,
    featured: false,
    is_new: true,
  })

  useEffect(() => {
    listAdminCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    if (!id) return
    getAdminProduct(id)
      .then((product) => {
        if (!product) return
        setForm({
          name: product.name,
          category_id: product.category_id ?? '',
          description: product.description ?? '',
          additional_info: product.additional_info ?? '',
          price: String(product.price),
          promotional_price: product.promotional_price == null ? '' : String(product.promotional_price),
          status: product.status,
          featured: product.featured,
          is_new: product.is_new,
        })
        setVariants(
          product.variants.length
            ? product.variants.map((variant) => ({
                id: variant.id,
                size_label: variant.size_label,
                sku: variant.sku ?? '',
                quantity: variant.quantity,
                active: variant.active,
                display_order: variant.display_order,
              }))
            : [{ size_label: 'M', sku: '', quantity: 0, active: true, display_order: 1 }],
        )
        setGallery(
          product.images.map((image) => ({
            kind: 'saved',
            id: image.id,
            url: image.url,
            storage_path: image.storage_path,
            is_primary: image.is_primary,
          })),
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    return () => {
      galleryRef.current.forEach((item) => {
        if (item.kind === 'preview') URL.revokeObjectURL(item.url)
      })
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setSaveLabel('Salvando...')
    try {
      const payload = {
        name: form.name,
        category_id: form.category_id || null,
        description: form.description,
        additional_info: form.additional_info,
        sku: '',
        price: Number(form.price),
        promotional_price: form.promotional_price ? Number(form.promotional_price) : null,
        status: form.status,
        featured: form.featured,
        is_new: form.is_new,
      }
      const product = isEdit && id ? await updateProduct(id, payload) : await createProduct(payload)
      await upsertVariants(
        product.id,
        variants.map((variant, index) => ({
          ...variant,
          sku: variant.sku || '',
          display_order: index + 1,
        })),
      )

      const savedUpdates: { id: string; display_order: number; is_primary: boolean }[] = []
      const previews: { index: number; file: File }[] = []
      gallery.forEach((item, index) => {
        if (item.kind === 'preview') {
          previews.push({ index, file: item.file })
        } else {
          savedUpdates.push({ id: item.id, display_order: index + 1, is_primary: index === 0 })
        }
      })

      if (previews.length) {
        setSaveLabel('Enviando imagens...')
        const compressedFiles = await Promise.all(previews.map((preview) => compressImageFile(preview.file)))
        compressedFiles.forEach(validateImageFile)

        const uploaded = await mapPool(compressedFiles, 3, async (file) => {
          const path = makeObjectPath(product.id, file)
          return uploadImage('product-images', path, file)
        })

        await addProductImages(
          uploaded.map((item, uploadIndex) => {
            const preview = previews[uploadIndex]
            const orderIndex = preview?.index ?? uploadIndex
            return {
              product_id: product.id,
              url: item.url,
              storage_path: item.path,
              alt: form.name,
              is_primary: orderIndex === 0,
              display_order: orderIndex + 1,
            }
          }),
        )
      }
      if (savedUpdates.length) await updateImageOrder(savedUpdates)

      toast.success(isEdit ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')
      navigate('/admin/produtos')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
      setSaveLabel('Salvar produto')
    }
  }

  if (loading) return <PageLoader />

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-8">
      <Seo title={isEdit ? 'Editar produto' : 'Novo produto'} />
      <div>
        <h1 className="font-display text-3xl">{isEdit ? 'Editar produto' : 'Novo produto'}</h1>
        <p className="text-sm text-metal-400">Preencha as informações, imagens e variações de tamanho.</p>
      </div>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <h2 className="font-display text-lg">Informações principais</h2>
        <Field label="Nome">
          <Input required value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </Field>
        <Field label="Categoria">
          <Select value={form.category_id} onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}>
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descrição">
          <Textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
        </Field>
        <Field label="Informações adicionais">
          <Textarea value={form.additional_info} onChange={(event) => setForm((prev) => ({ ...prev, additional_info: event.target.value }))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preço">
            <Input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))} />
          </Field>
          <Field label="Preço promocional" hint="Opcional. Deixe vazio se não houver promoção real.">
            <Input type="number" min="0" step="0.01" value={form.promotional_price} onChange={(event) => setForm((prev) => ({ ...prev, promotional_price: event.target.value }))} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ProductStatus }))}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))} />
            Destaque
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_new} onChange={(event) => setForm((prev) => ({ ...prev, is_new: event.target.checked }))} />
            Produto novo
          </label>
        </div>
      </section>

      <ProductImageGallery
        items={gallery}
        maxItems={MAX_PRODUCT_IMAGES}
        onChange={setGallery}
        onAddFiles={(files) => {
          setGallery((current) => {
            const available = MAX_PRODUCT_IMAGES - current.length
            if (available <= 0) {
              toast.error(`Limite de ${MAX_PRODUCT_IMAGES} fotos por produto.`)
              return current
            }
            const accepted = files.slice(0, available)
            if (files.length > available) {
              toast.message(`Só foram adicionadas ${accepted.length} foto(s). Limite: ${MAX_PRODUCT_IMAGES}.`)
            }
            try {
              accepted.forEach(validateImageFile)
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Arquivo de imagem inválido.')
              return current
            }
            return [
              ...current,
              ...accepted.map((file) => ({ kind: 'preview' as const, file, url: URL.createObjectURL(file) })),
            ]
          })
        }}
        onRemove={async (item, index) => {
          if (item.kind === 'preview') {
            URL.revokeObjectURL(item.url)
            setGallery((current) => current.filter((_, itemIndex) => itemIndex !== index))
            return
          }
          try {
            await deleteProductImage(item.id)
            await removeImage('product-images', item.storage_path)
            setGallery((current) => current.filter((entry) => entry.kind !== 'saved' || entry.id !== item.id))
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a imagem.')
          }
        }}
      />

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">Tamanhos e estoque</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setVariants((current) => [
                ...current,
                { size_label: '', sku: '', quantity: 0, active: true, display_order: current.length + 1 },
              ])
            }
          >
            Adicionar tamanho
          </Button>
        </div>
        <p className="text-xs text-metal-500">
          A quantidade pode ser alterada aqui. Mudanças em variantes já salvas geram histórico de estoque (ajuste).
        </p>
        <div className="space-y-3">
          {variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-4">
              <Input
                placeholder="Tamanho (P, M, 40, Único)"
                value={variant.size_label}
                onChange={(event) =>
                  setVariants((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, size_label: event.target.value } : item)))
                }
                required
              />
              <Input
                type="number"
                min="0"
                value={variant.quantity}
                onChange={(event) =>
                  setVariants((current) =>
                    current.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item)),
                  )
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={variant.active}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? { ...item, active: event.target.checked } : item)),
                    )
                  }
                />
                Ativo
              </label>
              <Button type="button" variant="ghost" onClick={() => setVariants((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                Remover
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Button type="submit" disabled={saving}>
        {saving ? saveLabel : 'Salvar produto'}
      </Button>
    </form>
  )
}
