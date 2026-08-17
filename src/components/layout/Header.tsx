import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Search, ShoppingBag, X } from 'lucide-react'
import { useState } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useSettings } from '@/contexts/SettingsContext'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/cn'

const links = [
  { to: '/', label: 'Início' },
  { to: '/produtos', label: 'Produtos' },
  { to: '/sobre', label: 'Sobre' },
  { to: '/contato', label: 'Contato' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const { count } = useCart()
  const settings = useSettings()
  const location = useLocation()

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:h-[4.5rem] sm:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label="WM Imports — início">
          <img src={logo} alt="WM Imports" className="h-10 w-auto sm:h-12" />
          <span className="hidden font-display text-sm tracking-[0.28em] text-metal-300 sm:inline">
            {settings?.city ?? 'Sertânia'}/{settings?.state ?? 'PE'}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'text-sm tracking-wide text-metal-400 transition hover:text-white',
                  isActive && 'text-white',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/produtos"
            className="rounded-full p-2 text-metal-300 hover:bg-white/5 hover:text-white"
            aria-label="Buscar produtos"
          >
            <Search size={20} />
          </Link>
          <Link
            to="/carrinho"
            className="relative rounded-full p-2 text-metal-300 hover:bg-white/5 hover:text-white"
            aria-label={`Carrinho com ${count} itens`}
          >
            <ShoppingBag size={20} />
            {count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-metal-200 px-1 text-[10px] font-semibold text-ink">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            className="rounded-full p-2 text-metal-300 hover:bg-white/5 md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/80 md:hidden">
          <div className="ml-auto flex h-full w-[min(100%,20rem)] flex-col bg-ink p-6">
            <div className="mb-8 flex items-center justify-between">
              <img src={logo} alt="" className="h-10" />
              <button onClick={() => setOpen(false)} aria-label="Fechar menu" className="p-2">
                <X />
              </button>
            </div>
            <nav className="grid gap-4" aria-label="Mobile">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={cn('font-display text-2xl', location.pathname === link.to ? 'text-white' : 'text-metal-400')}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  )
}
