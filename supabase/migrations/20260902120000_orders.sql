-- WM Imports — pedidos online (fluxo público, sem baixa de estoque na criação)

-- ---------------------------------------------------------------------------
-- 1. Sequence e helper para order_number
-- ---------------------------------------------------------------------------

create sequence if not exists public.order_number_seq start 1;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  v_seq bigint;
begin
  v_seq := nextval('public.order_number_seq');
  return format('WM-%s-%04s', to_char(now() at time zone 'America/Sao_Paulo', 'YYYYMMDD'), v_seq);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabelas orders / order_items
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  notes text,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'preparing', 'shipped', 'completed', 'cancelled')),
  payment_method text
    check (payment_method is null or payment_method in ('pix', 'dinheiro', 'cartao', 'outro')),
  total_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  variation_id uuid references public.product_variants (id),
  variation_name text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null
);

create index order_items_order_id_idx on public.order_items (order_id);
create index orders_status_idx on public.orders (status);
create index orders_created_at_idx on public.orders (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Trigger updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. RPC create_order (SECURITY DEFINER — público, sem baixa de estoque)
-- ---------------------------------------------------------------------------

create or replace function public.create_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_qty integer;
  v_price numeric(10, 2);
  v_line_total numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_items_result jsonb := '[]'::jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_item_count integer;
begin
  v_name := nullif(trim(coalesce(p_customer_name, '')), '');
  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_email := nullif(trim(lower(coalesce(p_customer_email, ''))), '');

  if v_name is null or length(v_name) < 2 then
    raise exception 'Informe um nome válido (mínimo 2 caracteres)';
  end if;

  if length(v_name) > 120 then
    raise exception 'Nome muito longo (máximo 120 caracteres)';
  end if;

  if v_phone is null or length(v_phone) < 10 or length(v_phone) > 15 then
    raise exception 'Informe um WhatsApp válido (10 a 15 dígitos)';
  end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido';
  end if;

  if length(v_email) > 254 then
    raise exception 'E-mail muito longo (máximo 254 caracteres)';
  end if;

  if p_notes is not null and length(trim(p_notes)) > 500 then
    raise exception 'Observação muito longa (máximo 500 caracteres)';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count > 20 then
    raise exception 'Máximo de 20 itens por pedido';
  end if;

  v_order_number := public.generate_order_number();

  insert into public.orders (
    order_number,
    customer_name,
    customer_phone,
    customer_email,
    notes,
    status,
    payment_method,
    total_amount
  ) values (
    v_order_number,
    v_name,
    v_phone,
    v_email,
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending_payment',
    null,
    0
  )
  returning id into v_order_id;

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

    if not v_variant.active then
      raise exception 'Variante indisponível: %', v_variant.size_label;
    end if;

    select * into v_product from public.products where id = v_variant.product_id;

    if not found then
      raise exception 'Produto não encontrado';
    end if;

    if v_product.status <> 'active' then
      raise exception 'Produto indisponível: %', v_product.name;
    end if;

    if v_variant.quantity < v_qty then
      raise exception 'Estoque insuficiente para a variante %', v_variant.size_label;
    end if;

    if v_qty > least(v_variant.quantity, 10) then
      raise exception 'Quantidade máxima por item é %', least(v_variant.quantity, 10);
    end if;

    if v_product.promotional_price is not null
       and v_product.promotional_price > 0
       and v_product.promotional_price < v_product.price then
      v_price := v_product.promotional_price;
    else
      v_price := v_product.price;
    end if;

    v_line_total := v_price * v_qty;
    v_total := v_total + v_line_total;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      variation_id,
      variation_name,
      quantity,
      unit_price,
      total_price
    ) values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_variant.id,
      v_variant.size_label,
      v_qty,
      v_price,
      v_line_total
    );

    v_items_result := v_items_result || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name,
      'variation_id', v_variant.id,
      'variation_name', v_variant.size_label,
      'quantity', v_qty,
      'unit_price', v_price,
      'total_price', v_line_total
    ));
  end loop;

  update public.orders
  set total_amount = v_total
  where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total,
    'items', v_items_result
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RLS — admin lê; escrita só via RPC
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy orders_admin_select on public.orders
  for select to authenticated
  using (public.is_admin());

create policy order_items_admin_select on public.order_items
  for select to authenticated
  using (public.is_admin());

revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Grants de execute
-- ---------------------------------------------------------------------------

revoke all on function public.create_order(text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, jsonb) to anon, authenticated;

revoke all on function public.generate_order_number() from public;
