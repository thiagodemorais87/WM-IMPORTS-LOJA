import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/Card'
import { PageLoader } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/EmptyState'
import { Seo } from '@/components/ui/Seo'
import { CountUp, FadeIn } from '@/components/bits/Motion'
import { getDashboardStats } from '@/services/dashboard.service'
import { formatCurrency } from '@/lib/format'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DashboardStats } from '@/types'

type SalesCard = {
  label: string
  value: number
  currency?: boolean
  suffix?: string
  link?: string
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setError('Não foi possível carregar o dashboard.'))
  }, [])

  if (error) return <ErrorState message={error} />
  if (!stats) return <PageLoader />

  const catalogCards = [
    { label: 'Produtos', value: stats.totalProducts },
    { label: 'Ativos', value: stats.activeProducts },
    { label: 'Estoque', value: stats.totalUnits, suffix: ' un.' },
    { label: 'Estoque baixo', value: stats.lowStock },
    { label: 'Esgotados', value: stats.outOfStock },
  ]

  const salesCards: SalesCard[] = [
    {
      label: 'Aguardando pagamento',
      value: stats.pendingPaymentCount,
      link: '/admin/pedidos?status=pending_payment',
    },
    { label: 'Vendas hoje', value: stats.salesTodayCount },
    { label: 'Faturamento hoje', value: stats.revenueToday, currency: true },
    { label: 'Vendas do mês', value: stats.salesMonthCount },
    { label: 'Faturamento do mês', value: stats.revenueMonth, currency: true },
    { label: 'Ticket médio (mês)', value: stats.averageTicket, currency: true },
    { label: 'Produtos vendidos (mês)', value: stats.productsSoldMonth, suffix: ' un.' },
  ]

  return (
    <div>
      <Seo title="Dashboard" robots="noindex, nofollow" />
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-metal-500">Painel</p>
          <h1 className="mt-2 font-display text-3xl">Visão geral</h1>
        </div>
        <Link to="/admin/produtos/novo" className="text-sm text-metal-300 hover:text-white">
          Cadastrar produto →
        </Link>
      </div>

      <h2 className="mb-4 font-display text-lg text-white">Pedidos e vendas</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {salesCards.map((card, index) => (
          <FadeIn key={card.label} delay={index * 0.05}>
            <Card className={card.link ? 'transition hover:border-white/20' : undefined}>
              {card.link ? (
                <Link to={card.link} className="block">
                  <p className="text-sm text-metal-500">{card.label}</p>
                  <p className="mt-2 font-display text-3xl text-white">
                    {card.currency ? (
                      formatCurrency(card.value)
                    ) : (
                      <>
                        <CountUp value={card.value} />
                        {card.suffix ?? ''}
                      </>
                    )}
                  </p>
                </Link>
              ) : (
                <>
                  <p className="text-sm text-metal-500">{card.label}</p>
                  <p className="mt-2 font-display text-3xl text-white">
                    {card.currency ? (
                      formatCurrency(card.value)
                    ) : (
                      <>
                        <CountUp value={card.value} />
                        {card.suffix ?? ''}
                      </>
                    )}
                  </p>
                </>
              )}
            </Card>
          </FadeIn>
        ))}
      </div>

      <h2 className="mb-4 mt-10 font-display text-lg text-white">Catálogo e estoque</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {catalogCards.map((card, index) => (
          <FadeIn key={card.label} delay={index * 0.05}>
            <Card>
              <p className="text-sm text-metal-500">{card.label}</p>
              <p className="mt-2 font-display text-3xl text-white">
                <CountUp value={card.value} />
                {card.suffix ?? ''}
              </p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-lg">Faturamento (14 dias)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.salesByDay}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                  stroke="#8a8a8a"
                  fontSize={12}
                />
                <YAxis stroke="#8a8a8a" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #2a2a2a' }}
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                />
                <Bar dataKey="total" fill="#c0c0c0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-display text-lg">Produtos mais vendidos</h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-metal-500">Nenhuma venda registrada ainda.</p>
          ) : (
            <ul className="space-y-3">
              {stats.topProducts.map((item) => (
                <li key={item.name} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="text-metal-400">{item.quantity} un.</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
