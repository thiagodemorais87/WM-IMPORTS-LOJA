import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PublicLayout } from '@/layouts/PublicLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ProtectedRoute } from '@/components/admin/ProtectedRoute'
import { PageLoader } from '@/components/ui/Spinner'

const HomePage = lazy(() => import('@/pages/public/HomePage').then((module) => ({ default: module.HomePage })))
const ProductsPage = lazy(() => import('@/pages/public/ProductsPage').then((module) => ({ default: module.ProductsPage })))
const ProductDetailPage = lazy(() =>
  import('@/pages/public/ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })),
)
const AboutPage = lazy(() => import('@/pages/public/AboutPage').then((module) => ({ default: module.AboutPage })))
const ContactPage = lazy(() => import('@/pages/public/ContactPage').then((module) => ({ default: module.ContactPage })))
const CartPage = lazy(() => import('@/pages/public/CartPage').then((module) => ({ default: module.CartPage })))
const NotFoundPage = lazy(() => import('@/pages/public/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const LoginPage = lazy(() => import('@/pages/admin/LoginPage').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const ProductsListPage = lazy(() =>
  import('@/pages/admin/ProductsListPage').then((module) => ({ default: module.ProductsListPage })),
)
const ProductFormPage = lazy(() =>
  import('@/pages/admin/ProductFormPage').then((module) => ({ default: module.ProductFormPage })),
)
const CategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage').then((module) => ({ default: module.CategoriesPage })))
const BannersPage = lazy(() => import('@/pages/admin/BannersPage').then((module) => ({ default: module.BannersPage })))
const HighlightsPage = lazy(() => import('@/pages/admin/HighlightsPage').then((module) => ({ default: module.HighlightsPage })))
const SalesPage = lazy(() => import('@/pages/admin/SalesPage').then((module) => ({ default: module.SalesPage })))
const StockPage = lazy(() => import('@/pages/admin/StockPage').then((module) => ({ default: module.StockPage })))
const SettingsPage = lazy(() => import('@/pages/admin/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function ScreenLoader() {
  return <PageLoader />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<ScreenLoader />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/produto/:id" element={<ProductDetailPage />} />
          <Route path="/sobre" element={<AboutPage />} />
          <Route path="/contato" element={<ContactPage />} />
          <Route path="/carrinho" element={<CartPage />} />
        </Route>
        <Route path="/admin/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="produtos" element={<ProductsListPage />} />
            <Route path="produtos/novo" element={<ProductFormPage />} />
            <Route path="produtos/:id" element={<ProductFormPage />} />
            <Route path="categorias" element={<CategoriesPage />} />
            <Route path="banners" element={<BannersPage />} />
            <Route path="destaques" element={<HighlightsPage />} />
            <Route path="vendas" element={<SalesPage />} />
            <Route path="estoque" element={<StockPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
