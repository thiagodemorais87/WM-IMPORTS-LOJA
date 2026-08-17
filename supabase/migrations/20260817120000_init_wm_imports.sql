-- WM Imports — schema inicial, RLS, storage, funções e seed
-- Projeto: tbgfhfcizzahpcpgukbh
-- Ordem: extensões → tabelas → índices → funções → triggers → estoque/vendas
--        → grants → RLS → policies → storage → seed (inclui usuário admin)

-- ---------------------------------------------------------------------------
-- 1. Extensões
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. Tabela public.profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. Demais tabelas
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  additional_info text,
  sku text unique,
  price numeric(10, 2) not null check (price >= 0),
  promotional_price numeric(10, 2) check (promotional_price is null or promotional_price >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  featured boolean not null default false,
  is_new boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  storage_path text not null,
  alt text,
  is_primary boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size_label text not null,
  sku text,
  quantity integer not null default 0 check (quantity >= 0),
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_label)
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  payment_method text not null check (payment_method in ('pix', 'dinheiro', 'cartao', 'outro')),
  notes text,
  total numeric(10, 2) not null default 0,
  sold_at timestamptz not null default now(),
  user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  variant_id uuid not null references public.product_variants (id),
  product_name text not null,
  size_label text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  subtotal numeric(10, 2) not null
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  sale_id uuid references public.sales (id) on delete set null,
  type text not null check (type in ('entrada', 'venda', 'ajuste', 'devolucao')),
  quantity_change integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  reason text,
  user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'WM Imports',
  logo_url text,
  whatsapp text,
  instagram text,
  description text,
  address text,
  city text not null default 'Sertânia',
  state text not null default 'PE',
  business_hours text,
  low_stock_threshold integer not null default 3,
  whatsapp_message_template text,
  tagline text not null default 'De Sertânia para todo o Brasil.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  extra_text text,
  image_url text,
  storage_path text,
  button_text text,
  button_link text,
  type text not null default 'institutional'
    check (type in ('institutional', 'promotion', 'announcement', 'collection')),
  active boolean not null default true,
  display_order integer not null default 0,
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_highlights (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text not null default 'Package',
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Índices
-- ---------------------------------------------------------------------------

create index idx_products_status on public.products (status);
create index idx_products_category on public.products (category_id);
create index idx_products_featured on public.products (featured) where featured = true;
create index idx_products_name_search on public.products using gin (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(sku, '')));
create index idx_product_images_product on public.product_images (product_id, display_order);
create index idx_product_variants_product on public.product_variants (product_id);
create index idx_stock_movements_created on public.stock_movements (created_at desc);
create index idx_stock_movements_variant on public.stock_movements (variant_id);
create index idx_sales_sold_at on public.sales (sold_at desc);
create index idx_sale_items_sale on public.sale_items (sale_id);
create index idx_banners_active_order on public.banners (active, display_order);
create index idx_categories_slug on public.categories (slug);

-- ---------------------------------------------------------------------------
-- 5. Funções que dependem das tabelas
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SECURITY DEFINER + row_security = off evita recursão com policies de profiles
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
end;
$$;

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
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Administrador'),
    coalesce(new.email, ''),
    'admin'
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(public.profiles.name, ''), excluded.name);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Triggers (depois de profiles, set_updated_at e handle_new_user)
-- ---------------------------------------------------------------------------

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create trigger trg_products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create trigger trg_product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

create trigger trg_store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

create trigger trg_banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

create trigger trg_store_highlights_updated_at before update on public.store_highlights
  for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7. Funções de estoque e vendas
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
  v_total numeric(10, 2) := 0;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

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
    v_price := (v_item->>'unit_price')::numeric;

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

  update public.sales set total = v_total where id = v_sale_id;

  return v_sale_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.register_sale(text, text, text, timestamptz, jsonb) to authenticated;

grant usage on schema public to anon, authenticated;

grant select on
  public.categories,
  public.products,
  public.product_images,
  public.product_variants,
  public.store_settings,
  public.banners,
  public.store_highlights
to anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.categories,
  public.products,
  public.product_images,
  public.product_variants,
  public.sales,
  public.sale_items,
  public.stock_movements,
  public.store_settings,
  public.banners,
  public.store_highlights
to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.store_settings enable row level security;
alter table public.banners enable row level security;
alter table public.store_highlights enable row level security;

-- ---------------------------------------------------------------------------
-- 10. Policies
-- ---------------------------------------------------------------------------

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());

create policy categories_public_select on public.categories
  for select to anon, authenticated
  using (active = true or public.is_admin());

create policy categories_admin_all on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy products_public_select on public.products
  for select to anon, authenticated
  using (status = 'active' or public.is_admin());

create policy products_admin_all on public.products
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy product_images_public_select on public.product_images
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.status = 'active'
    )
  );

create policy product_images_admin_all on public.product_images
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy product_variants_public_select on public.product_variants
  for select to anon, authenticated
  using (
    public.is_admin()
    or (
      active = true
      and exists (
        select 1 from public.products p
        where p.id = product_variants.product_id and p.status = 'active'
      )
    )
  );

create policy product_variants_admin_all on public.product_variants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sales_admin_all on public.sales
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sale_items_admin_all on public.sale_items
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy stock_movements_admin_select on public.stock_movements
  for select to authenticated
  using (public.is_admin());

create policy stock_movements_admin_insert on public.stock_movements
  for insert to authenticated
  with check (public.is_admin());

create policy store_settings_public_select on public.store_settings
  for select to anon, authenticated
  using (true);

create policy store_settings_admin_update on public.store_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy store_settings_admin_insert on public.store_settings
  for insert to authenticated
  with check (public.is_admin());

create policy banners_public_select on public.banners
  for select to anon, authenticated
  using (
    public.is_admin()
    or (
      active = true
      and (start_date is null or start_date <= now())
      and (end_date is null or end_date >= now())
    )
  );

create policy banners_admin_all on public.banners
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy highlights_public_select on public.store_highlights
  for select to anon, authenticated
  using (active = true or public.is_admin());

create policy highlights_admin_all on public.store_highlights
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 11. Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'store-assets',
    'store-assets',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

drop policy if exists storage_product_images_public_read on storage.objects;
drop policy if exists storage_product_images_admin_write on storage.objects;
drop policy if exists storage_product_images_admin_update on storage.objects;
drop policy if exists storage_product_images_admin_delete on storage.objects;
drop policy if exists storage_store_assets_public_read on storage.objects;
drop policy if exists storage_store_assets_admin_write on storage.objects;
drop policy if exists storage_store_assets_admin_update on storage.objects;
drop policy if exists storage_store_assets_admin_delete on storage.objects;

create policy storage_product_images_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy storage_product_images_admin_write
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy storage_product_images_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy storage_product_images_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy storage_store_assets_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store-assets');

create policy storage_store_assets_admin_write
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-assets' and public.is_admin());

create policy storage_store_assets_admin_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-assets' and public.is_admin())
  with check (bucket_id = 'store-assets' and public.is_admin());

create policy storage_store_assets_admin_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-assets' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 12. Seed
-- ---------------------------------------------------------------------------

insert into public.store_settings (
  id, store_name, city, state, tagline, description, business_hours,
  low_stock_threshold, whatsapp_message_template
) values (
  1,
  'WM Imports',
  'Sertânia',
  'PE',
  'De Sertânia para todo o Brasil.',
  'Moda, estilo e qualidade em um só lugar. A WM Imports está em Sertânia/PE e envia para todo o país.',
  'Segunda a sábado, 8h às 18h',
  3,
  'Olá! Tenho interesse no produto WM Imports:'
)
on conflict (id) do nothing;

insert into public.categories (name, slug, description, display_order) values
  ('Camisas', 'camisas', 'Camisas sociais e casuais', 1),
  ('Camisas Polo', 'camisas-polo', 'Polos clássicas e modernas', 2),
  ('T-Shirts', 't-shirts', 'Camisetas e oversized', 3),
  ('Calças', 'calcas', 'Calças jeans e casuais', 4),
  ('Óculos', 'oculos', 'Óculos de sol e acessórios', 5)
on conflict (slug) do nothing;

insert into public.banners (
  title, subtitle, extra_text, button_text, button_link, type, display_order, active
)
select *
from (
  values
    (
      'WM Imports',
      'Estilo, qualidade e praticidade para você.',
      'Sertânia/PE • Enviamos para todo o Brasil',
      'Ver produtos',
      '/produtos',
      'institutional',
      1,
      true
    ),
    (
      'Seu próximo look está aqui.',
      'Confira nossas camisas, polos, t-shirts, calças, óculos e muito mais.',
      null,
      'Explorar catálogo',
      '/produtos',
      'institutional',
      2,
      true
    ),
    (
      'Gostou de algum produto?',
      'Escolha seu produto e fale diretamente com a WM Imports pelo WhatsApp.',
      null,
      'Falar no WhatsApp',
      'whatsapp',
      'institutional',
      3,
      true
    ),
    (
      'WM Imports para todo o Brasil',
      'Estamos em Sertânia/PE e enviamos nossos produtos para todo o país.',
      'De Sertânia para todo o Brasil.',
      'Conhecer produtos',
      '/produtos',
      'institutional',
      4,
      true
    )
) as seed(
  title, subtitle, extra_text, button_text, button_link, type, display_order, active
)
where not exists (select 1 from public.banners);

insert into public.store_highlights (title, description, icon, display_order)
select *
from (
  values
    ('Envio para todo o Brasil', 'Receba seus produtos onde estiver. Consulte condições pelo WhatsApp.', 'Truck', 1),
    ('Atendimento pelo WhatsApp', 'Fale diretamente com a WM Imports.', 'MessageCircle', 2),
    ('Variedade de produtos', 'Camisas, polos, t-shirts, calças, óculos e muito mais.', 'Shirt', 3),
    ('De Sertânia para o Brasil', 'Nossa loja está em Sertânia/PE e atende clientes de todo o país.', 'MapPin', 4)
) as seed(title, description, icon, display_order)
where not exists (select 1 from public.store_highlights);

do $$
declare
  cat_polo uuid;
  cat_tee uuid;
  cat_camisa uuid;
  cat_calca uuid;
  cat_oculos uuid;
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
begin
  if exists (select 1 from public.products) then
    return;
  end if;

  select id into cat_polo from public.categories where slug = 'camisas-polo';
  select id into cat_tee from public.categories where slug = 't-shirts';
  select id into cat_camisa from public.categories where slug = 'camisas';
  select id into cat_calca from public.categories where slug = 'calcas';
  select id into cat_oculos from public.categories where slug = 'oculos';

  insert into public.products (category_id, name, slug, description, additional_info, sku, price, status, featured, is_new)
  values (
    cat_polo,
    'Camisa Polo Premium',
    'camisa-polo-premium',
    'Polo de caimento clássico, malha macia e acabamento reforçado. Peça versátil para o dia a dia e ocasiões casuais.',
    'Composição: algodão. Lavar à mão ou máquina no ciclo delicado.',
    'WM-POLO-001',
    159.90,
    'active',
    true,
    true
  ) returning id into p1;

  insert into public.products (category_id, name, slug, description, additional_info, sku, price, status, featured, is_new)
  values (
    cat_tee,
    'T-Shirt Oversized',
    't-shirt-oversized',
    'Camiseta oversized com modelagem contemporânea e tecido confortável. Ideal para looks casuais.',
    'Modelagem oversized. Consulte a tabela de medidas pelo WhatsApp.',
    'WM-TEE-001',
    89.90,
    'active',
    true,
    true
  ) returning id into p2;

  insert into public.products (category_id, name, slug, description, additional_info, sku, price, status, featured, is_new)
  values (
    cat_camisa,
    'Camisa Casual',
    'camisa-casual',
    'Camisa casual de visual limpo, perfeita para combinar com calças e acessórios da loja.',
    'Tecido leve. Passar em temperatura média.',
    'WM-CAM-001',
    139.90,
    'active',
    true,
    false
  ) returning id into p3;

  insert into public.products (category_id, name, slug, description, additional_info, sku, price, status, featured, is_new)
  values (
    cat_calca,
    'Calça Jeans',
    'calca-jeans',
    'Calça jeans de corte moderno e tecido resistente. Um básico que não pode faltar.',
    'Numeração por cintura. Em caso de dúvida, fale no WhatsApp.',
    'WM-CAL-001',
    189.90,
    'active',
    false,
    true
  ) returning id into p4;

  insert into public.products (category_id, name, slug, description, additional_info, sku, price, status, featured, is_new)
  values (
    cat_oculos,
    'Óculos de Sol Premium',
    'oculos-de-sol-premium',
    'Óculos de sol com proteção e design contemporâneo. Acessório para completar o visual.',
    'Peça única, sem variação de tamanho. Acompanhe as orientações de uso.',
    'WM-OCU-001',
    129.90,
    'active',
    true,
    true
  ) returning id into p5;

  insert into public.product_variants (product_id, size_label, quantity, display_order) values
    (p1, 'PP', 4, 1), (p1, 'P', 6, 2), (p1, 'M', 8, 3), (p1, 'G', 5, 4), (p1, 'GG', 3, 5), (p1, 'XGG', 2, 6),
    (p2, 'P', 5, 1), (p2, 'M', 7, 2), (p2, 'G', 4, 3), (p2, 'GG', 3, 4),
    (p3, 'P', 3, 1), (p3, 'M', 6, 2), (p3, 'G', 4, 3), (p3, 'GG', 2, 4),
    (p4, '36', 2, 1), (p4, '38', 4, 2), (p4, '40', 5, 3), (p4, '42', 3, 4), (p4, '44', 1, 5),
    (p5, 'Único', 10, 1);

  insert into public.product_images (product_id, url, storage_path, alt, is_primary, display_order) values
    (p1, 'https://images.unsplash.com/photo-1618354691373-d851c5c3a99b?w=1200&q=80', 'seed/polo-1.jpg', 'Camisa Polo Premium', true, 1),
    (p2, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80', 'seed/tee-1.jpg', 'T-Shirt Oversized', true, 1),
    (p3, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1200&q=80', 'seed/camisa-1.jpg', 'Camisa Casual', true, 1),
    (p4, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=1200&q=80', 'seed/calca-1.jpg', 'Calça Jeans', true, 1),
    (p5, 'https://images.unsplash.com/photo-1511499767100-828d98131648?w=1200&q=80', 'seed/oculos-1.jpg', 'Óculos de Sol Premium', true, 1);
end $$;

-- Usuário administrador do sistema
-- O trigger on_auth_user_created cria o registro em public.profiles
do $$
declare
  new_user_id uuid := gen_random_uuid();
  user_email text := 'xafullt@gmail.com';
  user_password text := 'WMImports@Sertania2026';
begin
  if exists (select 1 from auth.users where email = user_email) then
    return;
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', 'Thiago de Morais'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    new_user_id,
    new_user_id::text,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', user_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );
end $$;
