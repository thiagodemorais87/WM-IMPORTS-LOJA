-- Limite público de quantidade por variante (least(quantity, 10)) sem expor estoque exato acima de 10.

alter table public.product_variants
  add column if not exists max_request_qty integer
  generated always as (
    case when quantity > 0 then least(quantity, 10) else 0 end
  ) stored;

revoke select on public.product_variants from anon;

grant select (
  id,
  product_id,
  size_label,
  sku,
  active,
  display_order,
  in_stock,
  max_request_qty,
  created_at,
  updated_at
) on public.product_variants to anon;

grant select on public.product_variants to authenticated;
