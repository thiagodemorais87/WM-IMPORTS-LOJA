-- WM Imports — hardening de segurança (AppSec #2)
-- Aplica em projetos que já rodaram a migration inicial.
-- NÃO faz UPDATE massivo de roles: preserva admins existentes.
-- Provisionar novo admin: supabase/scripts/bootstrap_admin.sql

-- ---------------------------------------------------------------------------
-- 1. Roles: none (padrão) | admin (privilegiado)
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  alter column role set default 'none';

alter table public.profiles
  add constraint profiles_role_check check (role in ('none', 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Guard de escalação de role (só com wm.allow_role_change = 1)
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('wm.allow_role_change', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'none' then
      new.role := 'none';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Alteração de role não permitida via API';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before insert or update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- 3. handle_new_user: nunca promove a admin
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Usuário'),
    coalesce(new.email, ''),
    'none'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(public.profiles.name, ''), excluded.name);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Policies de profiles (anti-escalação)
-- ---------------------------------------------------------------------------

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'none');

drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());
-- Escalação de role bloqueada pelo trigger trg_guard_profile_role

-- ---------------------------------------------------------------------------
-- 5. Guard de quantidade em variantes (só RPC com flag)
-- ---------------------------------------------------------------------------

create or replace function public.guard_variant_quantity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('wm.allow_stock_mutation', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.quantity is distinct from old.quantity then
    raise exception 'Altere o estoque apenas via adjust_stock ou register_sale';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_variant_quantity on public.product_variants;
create trigger trg_guard_variant_quantity
  before update on public.product_variants
  for each row execute function public.guard_variant_quantity();

-- ---------------------------------------------------------------------------
-- 6. adjust_stock — flag de mutação
-- ---------------------------------------------------------------------------

create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_type text,
  p_quantity integer,
  p_reason text default null
)
returns public.product_variants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_variant public.product_variants;
  v_before integer;
  v_after integer;
  v_change integer;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

  perform set_config('wm.allow_stock_mutation', '1', true);

  if p_type not in ('entrada', 'ajuste', 'devolucao') then
    raise exception 'Tipo de movimentação inválido';
  end if;

  if p_quantity is null or p_quantity = 0 then
    raise exception 'Quantidade inválida';
  end if;

  select * into v_variant
  from public.product_variants
  where id = p_variant_id
  for update;

  if not found then
    raise exception 'Variante não encontrada';
  end if;

  v_before := v_variant.quantity;

  if p_type = 'ajuste' then
    if p_quantity < 0 then
      raise exception 'Ajuste não pode ser negativo';
    end if;
    v_after := p_quantity;
    v_change := v_after - v_before;
  elsif p_type = 'entrada' then
    if p_quantity < 0 then
      raise exception 'Entrada deve ser positiva';
    end if;
    v_change := p_quantity;
    v_after := v_before + v_change;
  else
    if p_quantity < 0 then
      raise exception 'Devolução deve ser positiva';
    end if;
    v_change := p_quantity;
    v_after := v_before + v_change;
  end if;

  if v_after < 0 then
    raise exception 'Estoque não pode ficar negativo';
  end if;

  update public.product_variants
  set quantity = v_after
  where id = p_variant_id
  returning * into v_variant;

  insert into public.stock_movements (
    product_id, variant_id, type, quantity_change,
    quantity_before, quantity_after, reason, user_id
  ) values (
    v_variant.product_id, v_variant.id, p_type, v_change,
    v_before, v_after, p_reason, auth.uid()
  );

  return v_variant;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. register_sale — preço no servidor (+ desconto auditável opcional)
-- ---------------------------------------------------------------------------

create or replace function public.register_sale(
  p_customer_name text,
  p_payment_method text,
  p_notes text,
  p_sold_at timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_before integer;
  v_after integer;
  v_qty integer;
  v_price numeric(10, 2);
  v_manual numeric(10, 2);
  v_discount_reason text;
  v_total numeric(10, 2) := 0;
  v_notes text := p_notes;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

  perform set_config('wm.allow_stock_mutation', '1', true);

  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'outro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item';
  end if;

  insert into public.sales (customer_name, payment_method, notes, sold_at, user_id, total)
  values (p_customer_name, p_payment_method, p_notes, coalesce(p_sold_at, now()), auth.uid(), 0)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select * into v_variant
    from public.product_variants
    where id = (v_item->>'variant_id')::uuid
    for update;

    if not found then
      raise exception 'Variante não encontrada';
    end if;

    if v_variant.quantity < v_qty then
      raise exception 'Estoque insuficiente para a variante %', v_variant.size_label;
    end if;

    select * into v_product from public.products where id = v_variant.product_id;

    if not found then
      raise exception 'Produto não encontrado';
    end if;

    -- Preço do catálogo (fonte da verdade)
    if v_product.promotional_price is not null
       and v_product.promotional_price > 0
       and v_product.promotional_price < v_product.price then
      v_price := v_product.promotional_price;
    else
      v_price := v_product.price;
    end if;

    -- Desconto manual opcional e auditável
    if v_item ? 'manual_unit_price' and nullif(v_item->>'manual_unit_price', '') is not null then
      v_discount_reason := nullif(trim(coalesce(v_item->>'discount_reason', '')), '');
      if v_discount_reason is null then
        raise exception 'Desconto manual exige discount_reason';
      end if;
      v_manual := (v_item->>'manual_unit_price')::numeric;
      if v_manual is null or v_manual < 0 then
        raise exception 'Preço manual inválido';
      end if;
      v_price := v_manual;
      v_notes := trim(both from coalesce(v_notes || E'\n', '') || format(
        'Desconto item %s (%s): %s',
        v_product.name,
        v_variant.size_label,
        v_discount_reason
      ));
    end if;

    v_before := v_variant.quantity;
    v_after := v_before - v_qty;
    v_total := v_total + (v_price * v_qty);

    update public.product_variants
    set quantity = v_after
    where id = v_variant.id;

    insert into public.sale_items (
      sale_id, product_id, variant_id, product_name, size_label,
      quantity, unit_price, subtotal
    ) values (
      v_sale_id, v_product.id, v_variant.id, v_product.name, v_variant.size_label,
      v_qty, v_price, v_price * v_qty
    );

    insert into public.stock_movements (
      product_id, variant_id, sale_id, type, quantity_change,
      quantity_before, quantity_after, reason, user_id
    ) values (
      v_product.id, v_variant.id, v_sale_id, 'venda', -v_qty,
      v_before, v_after, coalesce(p_notes, 'Venda registrada'), auth.uid()
    );
  end loop;

  update public.sales
  set total = v_total,
      notes = nullif(v_notes, '')
  where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Vendas / itens / movimentos: sem write direto via PostgREST
-- ---------------------------------------------------------------------------

drop policy if exists sales_admin_all on public.sales;
create policy sales_admin_select on public.sales
  for select to authenticated
  using (public.is_admin());

drop policy if exists sale_items_admin_all on public.sale_items;
create policy sale_items_admin_select on public.sale_items
  for select to authenticated
  using (public.is_admin());

drop policy if exists stock_movements_admin_insert on public.stock_movements;

revoke insert, update, delete on public.sales from authenticated;
revoke insert, update, delete on public.sale_items from authenticated;
revoke insert, update, delete on public.stock_movements from authenticated;

grant select on public.sales, public.sale_items, public.stock_movements to authenticated;

-- ---------------------------------------------------------------------------
-- 9. in_stock público (oculta quantity exata do anon)
-- ---------------------------------------------------------------------------

alter table public.product_variants
  add column if not exists in_stock boolean
  generated always as (quantity > 0) stored;

revoke select on public.product_variants from anon;

grant select (
  id,
  product_id,
  size_label,
  sku,
  active,
  display_order,
  in_stock,
  created_at,
  updated_at
) on public.product_variants to anon;

-- authenticated (admin) mantém SELECT completo via grant anterior
grant select on public.product_variants to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Validação de button_link em banners
-- ---------------------------------------------------------------------------

create or replace function public.is_safe_banner_link(link text)
returns boolean
language sql
immutable
as $$
  select
    link is null
    or btrim(link) = ''
    or lower(btrim(link)) = 'whatsapp'
    or btrim(link) ~ '^/'
    or btrim(link) ~* '^https://'
    or btrim(link) ~* '^http://';
$$;

create or replace function public.guard_banner_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.button_link is not null and not public.is_safe_banner_link(new.button_link) then
    raise exception 'button_link inválido: use path /..., https://..., http://... ou whatsapp';
  end if;
  if new.button_link is not null and (
    lower(new.button_link) ~* '^\s*javascript:'
    or lower(new.button_link) ~* '^\s*data:'
    or lower(new.button_link) ~* '^\s*vbscript:'
  ) then
    raise exception 'button_link com protocolo perigoso';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_banner_link on public.banners;
create trigger trg_guard_banner_link
  before insert or update on public.banners
  for each row execute function public.guard_banner_link();

-- ---------------------------------------------------------------------------
-- 11. Grants de execute (reafirma)
-- ---------------------------------------------------------------------------

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.register_sale(text, text, text, timestamptz, jsonb) to authenticated;
