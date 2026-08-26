-- =============================================================================
-- WM Imports — promover o administrador legítimo (one-shot)
-- =============================================================================
-- Use APÓS criar o usuário no Dashboard (Authentication > Users > Add user).
-- NÃO execute UPDATE em massa. Altere SOMENTE o e-mail abaixo.
--
-- Checklist pré-produção:
-- 1. Authentication > Providers > Email > desative "Enable sign ups"
-- 2. Rotacione a senha do admin no Dashboard (não use senhas do Git)
-- 3. Rode a migration 20260826000000_security_hardening.sql
-- 4. Preencha admin_email abaixo e execute este script UMA vez
-- 5. Confirme: select id, email, role from public.profiles;
-- =============================================================================

do $$
declare
  -- >>> ALTERE APENAS ESTA LINHA <<<
  admin_email text := 'SEU_EMAIL_ADMIN_AQUI';
  target_id uuid;
  updated_count integer;
begin
  if admin_email is null
     or btrim(admin_email) = ''
     or admin_email = 'SEU_EMAIL_ADMIN_AQUI' then
    raise exception 'Defina admin_email com o e-mail real do dono da loja antes de executar.';
  end if;

  select id into target_id
  from auth.users
  where lower(email) = lower(btrim(admin_email))
  limit 1;

  if target_id is null then
    raise exception 'Usuário % não encontrado em auth.users. Crie-o no Dashboard primeiro.', admin_email;
  end if;

  -- Permite mudança de role apenas neste bloco (trigger guard)
  perform set_config('wm.allow_role_change', '1', true);

  insert into public.profiles (id, name, email, role)
  values (
    target_id,
    coalesce(
      (select raw_user_meta_data->>'name' from auth.users where id = target_id),
      split_part(admin_email, '@', 1)
    ),
    lower(btrim(admin_email)),
    'admin'
  )
  on conflict (id) do update
    set role = 'admin',
        email = excluded.email,
        name = coalesce(nullif(public.profiles.name, ''), excluded.name),
        updated_at = now();

  get diagnostics updated_count = row_count;

  raise notice 'Admin provisionado: % (id=%). Linhas afetadas: %.', admin_email, target_id, updated_count;
end $$;

-- Verificação (deve retornar exatamente o e-mail promovido como admin)
select id, email, role, name, created_at
from public.profiles
where role = 'admin'
order by created_at;
