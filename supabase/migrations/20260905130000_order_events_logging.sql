-- WM Imports — helper de eventos + logging nas RPCs de pedidos

create or replace function public._log_order_event(
  p_order_id uuid,
  p_event_type text,
  p_message text,
  p_metadata jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_events (order_id, event_type, message, metadata, user_id)
  values (p_order_id, p_event_type, p_message, p_metadata, auth.uid());
end;
$$;

revoke all on function public._log_order_event(uuid, text, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- create_order — log order_created
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

  perform public._log_order_event(
    v_order_id,
    'order_created',
    'Pedido criado pelo site',
    jsonb_build_object('order_number', v_order_number, 'total_amount', v_total)
  );

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total_amount', v_total,
    'items', v_items_result
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_order_payment — log payment_confirmed + estoque
-- ---------------------------------------------------------------------------

create or replace function public.confirm_order_payment(
  p_order_id uuid,
  p_payment_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item public.order_items;
  v_variant public.product_variants;
  v_before integer;
  v_after integer;
  v_sale_id uuid;
  v_total numeric(10, 2) := 0;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

  if p_payment_method not in ('pix', 'dinheiro', 'cartao', 'outro') then
    raise exception 'Forma de pagamento inválida';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Pedido não está aguardando pagamento';
  end if;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'Pedido sem itens';
  end if;

  perform set_config('wm.allow_stock_mutation', '1', true);

  insert into public.sales (customer_name, payment_method, notes, sold_at, user_id, total)
  values (
    v_order.customer_name,
    p_payment_method,
    trim(both from coalesce(v_order.notes || E'\n', '') || format('Pedido %s', v_order.order_number)),
    now(),
    auth.uid(),
    0
  )
  returning id into v_sale_id;

  for v_item in
    select * from public.order_items where order_id = p_order_id
  loop
    if v_item.variation_id is null then
      raise exception 'Item sem variante';
    end if;

    select * into v_variant
    from public.product_variants
    where id = v_item.variation_id
    for update;

    if not found then
      raise exception 'Variante não encontrada';
    end if;

    if v_variant.quantity < v_item.quantity then
      raise exception 'Estoque insuficiente para a variante %', v_variant.size_label;
    end if;

    v_before := v_variant.quantity;
    v_after := v_before - v_item.quantity;
    v_total := v_total + v_item.total_price;

    update public.product_variants
    set quantity = v_after
    where id = v_variant.id;

    insert into public.sale_items (
      sale_id, product_id, variant_id, product_name, size_label,
      quantity, unit_price, subtotal
    ) values (
      v_sale_id,
      v_item.product_id,
      v_item.variation_id,
      v_item.product_name,
      coalesce(v_item.variation_name, 'Único'),
      v_item.quantity,
      v_item.unit_price,
      v_item.total_price
    );

    insert into public.stock_movements (
      product_id, variant_id, sale_id, type, quantity_change,
      quantity_before, quantity_after, reason, user_id
    ) values (
      v_item.product_id,
      v_item.variation_id,
      v_sale_id,
      'venda',
      -v_item.quantity,
      v_before,
      v_after,
      format('Pedido %s', v_order.order_number),
      auth.uid()
    );

    perform public._log_order_event(
      p_order_id,
      'stock_changed',
      format('Estoque: -%s %s (%s)', v_item.quantity, coalesce(v_item.variation_name, 'Único'), v_item.product_name),
      jsonb_build_object(
        'variant_id', v_item.variation_id,
        'quantity_delta', -v_item.quantity,
        'product_name', v_item.product_name
      )
    );
  end loop;

  update public.sales
  set total = greatest(v_total - v_order.discount_amount, 0)
  where id = v_sale_id;

  update public.orders
  set
    status = 'paid',
    payment_method = p_payment_method,
    paid_at = now(),
    sale_id = v_sale_id,
    total_amount = greatest(v_total - discount_amount, 0)
  where id = p_order_id;

  perform public._log_order_event(
    p_order_id,
    'payment_confirmed',
    format('Pagamento confirmado (%s)', p_payment_method),
    jsonb_build_object('payment_method', p_payment_method, 'sale_id', v_sale_id)
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'sale_id', v_sale_id,
    'order_number', v_order.order_number
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- update_order — log order_edited + delta estoque
-- ---------------------------------------------------------------------------

create or replace function public.update_order(
  p_order_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_notes text,
  p_discount_amount numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_variant public.product_variants;
  v_product public.products;
  v_qty integer;
  v_price numeric(10, 2);
  v_line_total numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_total numeric(10, 2);
  v_discount numeric(10, 2);
  v_name text;
  v_phone text;
  v_email text;
  v_old record;
  v_delta integer;
  v_reason text;
  v_item_count integer;
  v_paid_statuses text[] := array['paid', 'preparing', 'shipped'];
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status in ('cancelled', 'completed') then
    raise exception 'Pedido não pode ser editado neste status';
  end if;

  v_name := nullif(trim(coalesce(p_customer_name, '')), '');
  v_phone := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_email := nullif(trim(lower(coalesce(p_customer_email, ''))), '');
  v_discount := coalesce(p_discount_amount, 0);

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

  if p_notes is not null and length(trim(p_notes)) > 500 then
    raise exception 'Observação muito longa (máximo 500 caracteres)';
  end if;

  if v_discount < 0 then
    raise exception 'Desconto inválido';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count > 20 then
    raise exception 'Máximo de 20 itens por pedido';
  end if;

  v_reason := format('Pedido %s (edição)', v_order.order_number);

  create temp table _order_old_qty (
    variation_id uuid primary key,
    product_id uuid not null,
    quantity integer not null
  ) on commit drop;

  insert into _order_old_qty (variation_id, product_id, quantity)
  select variation_id, product_id, sum(quantity)
  from public.order_items
  where order_id = p_order_id and variation_id is not null
  group by variation_id, product_id;

  create temp table _order_new_qty (
    variation_id uuid primary key,
    product_id uuid not null,
    quantity integer not null
  ) on commit drop;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unit_price')::numeric;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    if v_price is null or v_price < 0 then
      raise exception 'Preço unitário inválido';
    end if;

    select * into v_variant
    from public.product_variants
    where id = (v_item->>'variant_id')::uuid;

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

    if v_order.status = 'pending_payment' then
      if v_variant.quantity < v_qty then
        raise exception 'Estoque insuficiente para a variante %', v_variant.size_label;
      end if;
    end if;

    insert into _order_new_qty (variation_id, product_id, quantity)
    values (v_variant.id, v_product.id, v_qty)
    on conflict (variation_id) do update
      set quantity = _order_new_qty.quantity + excluded.quantity;
  end loop;

  if v_order.status = any(v_paid_statuses) then
    perform set_config('wm.allow_stock_mutation', '1', true);

    for v_old in
      select
        coalesce(n.variation_id, o.variation_id) as variation_id,
        coalesce(n.product_id, o.product_id) as product_id,
        coalesce(o.quantity, 0) as old_quantity,
        coalesce(n.quantity, 0) as new_quantity
      from _order_old_qty o
      full outer join _order_new_qty n on n.variation_id = o.variation_id
    loop
      v_delta := v_old.new_quantity - v_old.old_quantity;

      if v_delta > 0 then
        perform public._order_stock_decrement(
          v_old.variation_id,
          v_old.product_id,
          v_delta,
          v_reason,
          v_order.sale_id
        );
        perform public._log_order_event(
          p_order_id,
          'stock_changed',
          format('Estoque: -%s (edição)', v_delta),
          jsonb_build_object('variant_id', v_old.variation_id, 'quantity_delta', -v_delta)
        );
      elsif v_delta < 0 then
        perform public._order_stock_return(
          v_old.variation_id,
          v_old.product_id,
          abs(v_delta),
          v_reason,
          v_order.sale_id
        );
        perform public._log_order_event(
          p_order_id,
          'stock_changed',
          format('Estoque: +%s (edição)', abs(v_delta)),
          jsonb_build_object('variant_id', v_old.variation_id, 'quantity_delta', abs(v_delta))
        );
      end if;
    end loop;
  end if;

  delete from public.order_items where order_id = p_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    v_price := (v_item->>'unit_price')::numeric;

    select * into v_variant
    from public.product_variants
    where id = (v_item->>'variant_id')::uuid;

    select * into v_product from public.products where id = v_variant.product_id;

    v_line_total := v_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

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
      p_order_id,
      v_product.id,
      v_product.name,
      v_variant.id,
      v_variant.size_label,
      v_qty,
      v_price,
      v_line_total
    );
  end loop;

  v_total := greatest(v_subtotal - v_discount, 0);

  update public.orders
  set
    customer_name = v_name,
    customer_phone = v_phone,
    customer_email = v_email,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    discount_amount = v_discount,
    total_amount = v_total
  where id = p_order_id;

  if v_order.sale_id is not null then
    delete from public.sale_items where sale_id = v_order.sale_id;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_qty := (v_item->>'quantity')::integer;
      v_price := (v_item->>'unit_price')::numeric;

      select * into v_variant
      from public.product_variants
      where id = (v_item->>'variant_id')::uuid;

      select * into v_product from public.products where id = v_variant.product_id;

      v_line_total := v_price * v_qty;

      insert into public.sale_items (
        sale_id, product_id, variant_id, product_name, size_label,
        quantity, unit_price, subtotal
      ) values (
        v_order.sale_id,
        v_product.id,
        v_variant.id,
        v_product.name,
        v_variant.size_label,
        v_qty,
        v_price,
        v_line_total
      );
    end loop;

    update public.sales
    set
      customer_name = v_name,
      total = v_total,
      notes = trim(both from coalesce(nullif(trim(coalesce(p_notes, '')), '') || E'\n', '') || format('Pedido %s', v_order.order_number))
    where id = v_order.sale_id;
  end if;

  perform public._log_order_event(
    p_order_id,
    'order_edited',
    'Pedido editado pelo admin',
    jsonb_build_object('total_amount', v_total, 'discount_amount', v_discount)
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'total_amount', v_total,
    'subtotal', v_subtotal,
    'discount_amount', v_discount
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_order — log order_cancelled + devolução estoque
-- ---------------------------------------------------------------------------

create or replace function public.cancel_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item public.order_items;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status in ('cancelled', 'completed') then
    raise exception 'Pedido não pode ser cancelado neste status';
  end if;

  v_reason := format('Cancelamento pedido %s', v_order.order_number);

  if v_order.status in ('paid', 'preparing', 'shipped') then
    perform set_config('wm.allow_stock_mutation', '1', true);

    for v_item in
      select * from public.order_items where order_id = p_order_id
    loop
      if v_item.variation_id is not null then
        perform public._order_stock_return(
          v_item.variation_id,
          v_item.product_id,
          v_item.quantity,
          v_reason,
          v_order.sale_id
        );
        perform public._log_order_event(
          p_order_id,
          'stock_changed',
          format('Estoque: +%s %s (%s)', v_item.quantity, coalesce(v_item.variation_name, 'Único'), v_item.product_name),
          jsonb_build_object(
            'variant_id', v_item.variation_id,
            'quantity_delta', v_item.quantity,
            'product_name', v_item.product_name
          )
        );
      end if;
    end loop;
  end if;

  update public.orders
  set
    status = 'cancelled',
    notes = trim(both from coalesce(notes || E'\n', '') || format('[Cancelado em %s]', to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')))
  where id = p_order_id;

  perform public._log_order_event(
    p_order_id,
    'order_cancelled',
    'Pedido cancelado',
    jsonb_build_object('previous_status', v_order.status)
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'status', 'cancelled'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- update_order_status — log status_changed
-- ---------------------------------------------------------------------------

create or replace function public.update_order_status(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_old_status text;
begin
  if not public.is_admin() then
    raise exception 'Não autorizado';
  end if;

  if p_status not in ('preparing', 'shipped', 'completed') then
    raise exception 'Status inválido';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if v_order.status = 'cancelled' then
    raise exception 'Pedido cancelado não pode ser alterado';
  end if;

  if v_order.status = 'completed' then
    raise exception 'Pedido já concluído';
  end if;

  if p_status = 'preparing' and v_order.status <> 'paid' then
    raise exception 'Transição inválida para em preparação';
  end if;

  if p_status = 'shipped' and v_order.status <> 'preparing' then
    raise exception 'Transição inválida para enviado';
  end if;

  if p_status = 'completed' and v_order.status <> 'shipped' then
    raise exception 'Transição inválida para concluído';
  end if;

  v_old_status := v_order.status;

  update public.orders
  set status = p_status
  where id = p_order_id;

  perform public._log_order_event(
    p_order_id,
    'status_changed',
    format('Status: %s → %s', v_old_status, p_status),
    jsonb_build_object('from', v_old_status, 'to', p_status)
  );

  return jsonb_build_object(
    'order_id', p_order_id,
    'order_number', v_order.order_number,
    'status', p_status
  );
end;
$$;
