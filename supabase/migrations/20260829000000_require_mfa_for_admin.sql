-- WM Imports — exige 2FA (AAL2) para is_admin()
-- IMPORTANTE: aplique somente após o admin enrollar TOTP no painel (/admin/mfa-setup).

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
  )
  and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
end;
$$;

comment on function public.is_admin() is
  'Admin autenticado com 2FA verificado (JWT aal2). Leitura do próprio profile permanece via policies separadas.';
