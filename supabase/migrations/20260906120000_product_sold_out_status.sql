-- Status sold_out + sync automático active <-> sold_out conforme estoque

-- 1. Ampliar check de status
alter table public.products drop constraint if exists products_status_check;
alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'active', 'archived', 'sold_out'));

-- 2. Helper: sincroniza status do produto com estoque das variantes ativas
create or replace function public.sync_product_stock_status(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_has_stock boolean;
begin
  if p_product_id is null then
    return;
  end if;

  select status into v_status
  from public.products
  where id = p_product_id
  for update;

  if not found then
    return;
  end if;

  -- Só transita automaticamente entre active e sold_out
  if v_status not in ('active', 'sold_out') then
    return;
  end if;

  select exists (
    select 1
    from public.product_variants
    where product_id = p_product_id
      and active = true
      and quantity > 0
  ) into v_has_stock;

  if v_status = 'active' and not v_has_stock then
    update public.products
    set status = 'sold_out'
    where id = p_product_id;
  elsif v_status = 'sold_out' and v_has_stock then
    update public.products
    set status = 'active'
    where id = p_product_id;
  end if;
end;
$$;

revoke all on function public.sync_product_stock_status(uuid) from public;
grant execute on function public.sync_product_stock_status(uuid) to authenticated;

-- 3. Trigger: qualquer mudança de quantity/active nas variantes dispara o sync
-- Cobre adjust_stock, register_sale, confirm_order_payment, update_order, cancel_order
create or replace function public.trg_sync_product_stock_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_product_stock_status(old.product_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    perform public.sync_product_stock_status(new.product_id);
    return new;
  end if;

  if new.quantity is distinct from old.quantity
     or new.active is distinct from old.active
     or new.product_id is distinct from old.product_id then
    perform public.sync_product_stock_status(new.product_id);
    if new.product_id is distinct from old.product_id then
      perform public.sync_product_stock_status(old.product_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_product_variants_sync_stock_status on public.product_variants;
create trigger trg_product_variants_sync_stock_status
  after insert or update of quantity, active, product_id or delete
  on public.product_variants
  for each row
  execute function public.trg_sync_product_stock_status();

-- 4. Backfill: produtos active sem estoque em variantes ativas → sold_out
update public.products p
set status = 'sold_out'
where p.status = 'active'
  and not exists (
    select 1
    from public.product_variants v
    where v.product_id = p.id
      and v.active = true
      and v.quantity > 0
  );

-- 5. Backfill inverso: sold_out com estoque → active (segurança)
update public.products p
set status = 'active'
where p.status = 'sold_out'
  and exists (
    select 1
    from public.product_variants v
    where v.product_id = p.id
      and v.active = true
      and v.quantity > 0
  );
