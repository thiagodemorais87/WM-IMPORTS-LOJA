import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { PageLoader } from '@/components/ui/Spinner'
import {
  addProductImage,
  createProduct,
  deleteProductImage,
  getAdminProduct,
  updateImageOrder,
  updateProduct,
  upsertVariants,
} from '@/services/products.service'
import { listAdminCategories } from '@/services/categories.service'
import { makeObjectPath, removeImage, uploadImage } from '@/services/storage.service'
import type { Category, ProductImage, ProductStatus } from '@/types'

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
  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<ProductImage[]>([])
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([])
  const [variants, setVariants] = useState<VariantDraft[]>([
    { size_label: 'M', sku: '', quantity: 0, active: true, display_order: 1 },
  ])
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    description: '',
    additional_info: '',
    sku: '',
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
          sku: product.sku ?? '',
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
        setImages(product.images)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        category_id: form.category_id || null,
        description: form.description,
        additional_info: form.additional_info,
        sku: form.sku,
        price: Number(form.price),
        promotional_price: form.promotional_price ? Number(form.promotional_price) : null,
        status: form.status,
        featured: form.featured,
        is_new: form.is_new,
      }
      const product = isEdit && id ? await updateProduct(id, payload) : await createProduct(payload)
      await upsertVariants(
        product.id,
        variants.map((variant, index) => ({ ...variant, display_order: index + 1 })),
      )

      for (const preview of previews) {
        const path = makeObjectPath(product.id, preview.file)
        const uploaded = await uploadImage('product-images', path, preview.file)
        await addProductImage({
          product_id: product.id,
          url: uploaded.url,
          storage_path: uploaded.path,
          alt: form.name,
          is_primary: images.length === 0,
          display_order: images.length + 1,
        })
      }

      toast.success(isEdit ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')
      navigate('/admin/produtos')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
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
          <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <Field label="Categoria">
          <Select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descrição">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
        <Field label="Informações adicionais">
          <Textarea value={form.additional_info} onChange={(event) => setForm({ ...form, additional_info: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preço">
            <Input type="number" min="0" step="0.01" required value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
          </Field>
          <Field label="Preço promocional" hint="Opcional. Deixe vazio se não houver promoção real.">
            <Input type="number" min="0" step="0.01" value={form.promotional_price} onChange={(event) => setForm({ ...form, promotional_price: event.target.value })} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <h2 className="font-display text-lg">Identificação</h2>
        <Field label="SKU">
          <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProductStatus })}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} />
            Destaque
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_new} onChange={(event) => setForm({ ...form, is_new: event.target.checked })} />
            Produto novo
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 p-5">
        <h2 className="font-display text-lg">Imagens</h2>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            const files = [...(event.target.files ?? [])]
            setPreviews((current) => [
              ...current,
              ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
            ])
          }}
        />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {images.map((image, index) => (
            <div key={image.id} className="relative">
              <img src={image.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
              <div className="mt-1 flex gap-1 text-[10px]">
                <button
                  type="button"
                  className="text-metal-300"
                  onClick={async () => {
                    const next = images.map((item, itemIndex) => ({
                      id: item.id,
                      display_order: itemIndex,
                      is_primary: item.id === image.id,
                    }))
                    await updateImageOrder(next)
                    setImages((current) => current.map((item) => ({ ...item, is_primary: item.id === image.id })))
                  }}
                >
                  {image.is_primary ? 'Principal' : 'Tornar principal'}
                </button>
                <button
                  type="button"
                  className="text-red-300"
                  onClick={async () => {
                    await deleteProductImage(image.id)
                    await removeImage('product-images', image.storage_path)
                    setImages((current) => current.filter((item) => item.id !== image.id))
                  }}
                >
                  Excluir
                </button>
                {index > 0 ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const next = [...images]
                      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                      const payload = next.map((item, itemIndex) => ({
                        id: item.id,
                        display_order: itemIndex,
                        is_primary: item.is_primary,
                      }))
                      await updateImageOrder(payload)
                      setImages(next)
                    }}
                  >
                    ←
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {previews.map((preview) => (
            <img key={preview.url} src={preview.url} alt="Pré-visualização" className="aspect-square w-full rounded-xl object-cover" />
          ))}
        </div>
      </section>

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
          O estoque de variantes já existentes deve ser alterado em Estoque para manter o histórico. Novas variantes aceitam quantidade inicial.
        </p>
        <div className="space-y-3">
          {variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-5">
              <Input
                placeholder="Tamanho (P, M, 40, Único)"
                value={variant.size_label}
                onChange={(event) =>
                  setVariants((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, size_label: event.target.value } : item)))
                }
                required
              />
              <Input
                placeholder="SKU"
                value={variant.sku}
                onChange={(event) =>
                  setVariants((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, sku: event.target.value } : item)))
                }
              />
              <Input
                type="number"
                min="0"
                disabled={Boolean(variant.id)}
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
        {saving ? 'Salvando...' : 'Salvar produto'}
      </Button>
    </form>
  )
}
