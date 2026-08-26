import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Seo } from '@/components/ui/Seo'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { archiveProduct, deleteProduct, duplicateProduct, listAdminProducts } from '@/services/products.service'
import { formatCurrency } from '@/lib/format'
import { totalStock } from '@/lib/stock'
import { PRODUCT_STATUS_LABELS } from '@/constants'
import type { ProductWithRelations } from '@/types'

export function ProductsListPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ProductWithRelations | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setProducts(await listAdminProducts(status))
    } catch {
      setError('Não foi possível carregar os produtos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [status])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200)
    return () => window.clearTimeout(timer)
  }, [search])

  const filtered = useMemo(() => {
    if (!debouncedSearch) return products
    return products.filter((product) =>
      [product.name, product.category?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(debouncedSearch)),
    )
  }, [products, debouncedSearch])

  return (
    <div>
      <Seo title="Produtos" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Produtos</h1>
          <p className="text-sm text-metal-400">Cadastro, estoque e publicação do catálogo.</p>
        </div>
        <Link to="/admin/produtos/novo">
          <Button>Novo produto</Button>
        </Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Input placeholder="Pesquisar nome ou categoria" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="draft">Rascunhos</option>
          <option value="archived">Arquivados</option>
        </Select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum produto encontrado." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/5 text-metal-400">
              <tr>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Estoque</th>
                <th className="px-4 py-3 font-medium">Preço</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{product.name}</td>
                  <td className="px-4 py-3">{product.category?.name ?? '—'}</td>
                  <td className="px-4 py-3">{totalStock(product.variants)}</td>
                  <td className="px-4 py-3">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={product.status === 'active' ? 'success' : product.status === 'archived' ? 'muted' : 'warning'}>
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link className="text-metal-300 hover:text-white" to={`/produto/${product.slug}`} target="_blank">
                        Ver
                      </Link>
                      <Link className="text-metal-300 hover:text-white" to={`/admin/produtos/${product.id}`}>
                        Editar
                      </Link>
                      <Link className="text-metal-300 hover:text-white" to="/admin/estoque">
                        Estoque
                      </Link>
                      <button
                        className="text-metal-300 hover:text-white"
                        onClick={async () => {
                          try {
                            const copy = await duplicateProduct(product.id)
                            toast.success('Produto duplicado.')
                            navigate(`/admin/produtos/${copy.id}`)
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Não foi possível duplicar.')
                          }
                        }}
                      >
                        Duplicar
                      </button>
                      <button
                        className="text-metal-300 hover:text-white"
                        onClick={async () => {
                          await archiveProduct(product.id)
                          toast.success('Produto arquivado.')
                          void load()
                        }}
                      >
                        Arquivar
                      </button>
                      <button className="text-red-300" onClick={() => setPendingDelete(product)}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir produto"
        description="Tem certeza que deseja excluir este produto? Prefira arquivar se ele já teve vendas."
        confirmLabel="Excluir"
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return
          try {
            await deleteProduct(pendingDelete.id)
            toast.success('Produto excluído.')
            setPendingDelete(null)
            void load()
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Não foi possível excluir.')
          }
        }}
      />
    </div>
  )
}
