import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Warehouse,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/cn'

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/produtos', label: 'Produtos', icon: Package },
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/banners', label: 'Banners', icon: Image },
  { to: '/admin/destaques', label: 'Diferenciais', icon: Sparkles },
  { to: '/admin/vendas', label: 'Vendas', icon: ShoppingBag },
  { to: '/admin/estoque', label: 'Estoque', icon: Warehouse },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings },
]

export function AdminLayout() {
  const { logout, profile } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="grid gap-1">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-metal-400 hover:bg-white/5 hover:text-white',
              isActive && 'bg-white/10 text-white',
            )
          }
        >
          <link.icon size={18} />
          {link.label}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-ink text-metal-100 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-white/10 p-5 lg:block">
        <img src={logo} alt="WM Imports" className="mb-8 h-12" />
        {nav}
        <button
          className="mt-8 flex items-center gap-2 px-3 text-sm text-metal-500 hover:text-white"
          onClick={async () => {
            await logout()
            navigate('/admin/login')
          }}
        >
          <LogOut size={16} /> Sair
        </button>
      </aside>

      <div>
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu />
          </button>
          <p className="text-sm text-metal-400">{profile?.name || profile?.email}</p>
        </header>
        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden">
          <div className="h-full w-[16rem] bg-ink p-5">
            <div className="mb-6 flex items-center justify-between">
              <img src={logo} alt="" className="h-10" />
              <button onClick={() => setOpen(false)} aria-label="Fechar">
                <X />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
    </div>
  )
}
