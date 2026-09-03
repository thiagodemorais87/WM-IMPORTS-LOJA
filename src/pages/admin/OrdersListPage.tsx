import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Seo } from '@/components/ui/Seo'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, ErrorState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/Spinner'
import { listOrders } from '@/services/orders.service'
import { formatCurrency, formatDate } from '@/lib/format'
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/constants'
import type { OrderStatus, OrderWithItems } from '@/types'

const STATUS_FILTERS: Array<{ value: 'all' | OrderStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pending_payment', label: 'Aguardando pagamento' },
  { value: 'paid', label: 'Pagos' },
  { value: 'preparing', label: 'Em preparação' },
  { value: 'shipped', label: 'Enviados' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'cancelled', label: 'Cancelados' },
]

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS_BADGE[status]
  return (
    <Badge tone={config.tone}>
      {config.emoji} {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}

export function OrdersListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>(() => {
    if (initialStatus && STATUS_FILTERS.some((filter) => filter.value === initialStatus)) {
      return initialStatus as OrderStatus
    }
    return 'all'
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setOrders(await listOrders())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 200)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (statusFilter === 'all') {
      if (searchParams.has('status')) {
        setSearchParams({}, { replace: true })
      }
      return
    }
    if (searchParams.get('status') !== statusFilter) {
      setSearchParams({ status: statusFilter }, { replace: true })
    }
  }, [statusFilter, searchParams, setSearchParams])

  const filtered = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false
      if (!debouncedSearch) return true

      const haystack = [
        order.order_number,
        order.customer_name,
        order.customer_phone,
        order.customer_email,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(debouncedSearch)
    })
  }, [orders, statusFilter, debouncedSearch])

  return (
    <div>
      <Seo title="Pedidos" robots="noindex, nofollow" />
      <div className="mb-6">
        <h1 className="font-display text-3xl">Pedidos</h1>
        <p className="text-sm text-metal-400">
          Pedidos recebidos pelo site com acompanhamento de pagamento e entrega.
          {!loading && !error ? (
            <span className="ml-1 text-metal-500">
              · {filtered.length} de {orders.length} pedido(s)
            </span>
          ) : null}
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Input
          placeholder="Buscar por nº, nome, WhatsApp ou e-mail"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatus)}>
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum pedido encontrado." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-white/5 text-metal-400">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className="border-t border-white/10">
                  <td className="px-4 py-3 font-medium text-white">{order.order_number}</td>
                  <td className="px-4 py-3">{order.customer_name}</td>
                  <td className="px-4 py-3">{order.customer_phone}</td>
                  <td className="px-4 py-3">{order.customer_email}</td>
                  <td className="px-4 py-3">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3">{formatCurrency(order.total_amount)}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Link className="text-metal-300 hover:text-white" to={`/admin/pedidos/${order.id}`}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
