-- Permite zerar estoque via adjust_stock (tipo ajuste com quantidade absoluta 0).
-- Entrada e devolução continuam exigindo quantidade > 0.

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

  if p_quantity is null then
    raise exception 'Quantidade inválida';
  end if;

  if p_type <> 'ajuste' and p_quantity = 0 then
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

  -- Sem mudança efetiva: não grava movimento
  if v_change = 0 then
    return v_variant;
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
