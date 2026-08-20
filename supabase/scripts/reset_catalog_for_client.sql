-- =============================================================================
-- WM Imports — reset de catálogo / vendas / estoque para go-live do cliente
-- =============================================================================
-- Executar no SQL Editor do Supabase (projeto de produção) UMA vez antes do deploy.
--
-- APAGA: stock_movements, sales (+ sale_items), products (+ images/variants)
-- MANTÉM: banners, store_highlights, categories, store_settings, auth/profiles
-- =============================================================================

begin;

delete from public.stock_movements;
delete from public.sales;      -- cascade remove public.sale_items
delete from public.products;   -- cascade remove product_images e product_variants

commit;
