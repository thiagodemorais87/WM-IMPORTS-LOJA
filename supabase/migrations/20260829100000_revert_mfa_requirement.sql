-- WM Imports — remove exigência de 2FA (AAL2) em is_admin()

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

comment on function public.is_admin() is
  'Admin autenticado (role=admin). Leitura do próprio profile permanece via policies separadas.';
