-- =============================================================================
-- WM Imports — atualizar senha do administrador (placeholders)
-- =============================================================================
-- NUNCA commite senhas reais neste arquivo.
-- Prefira trocar a senha pelo Dashboard: Authentication > Users > Reset password.
-- Se precisar via SQL, preencha os placeholders e execute UMA vez no SQL Editor.
-- Depois remova os valores locais / não faça commit com senha.
-- =============================================================================

create extension if not exists "pgcrypto";

do $$
declare
  -- >>> PREENCHA LOCALMENTE — NÃO COMMITAR VALORES REAIS <<<
  admin_email text := 'SEU_EMAIL_ADMIN_AQUI';
  new_password text := 'DEFINA_SENHA_FORTE_AQUI';
  target_id uuid;
begin
  if admin_email = 'SEU_EMAIL_ADMIN_AQUI' or new_password = 'DEFINA_SENHA_FORTE_AQUI' then
    raise exception 'Substitua admin_email e new_password por valores reais antes de executar.';
  end if;

  if length(new_password) < 12 then
    raise exception 'Use senha com pelo menos 12 caracteres.';
  end if;

  select id into target_id
  from auth.users
  where lower(email) = lower(btrim(admin_email))
  limit 1;

  if target_id is null then
    raise exception 'Usuário % não encontrado.', admin_email;
  end if;

  update auth.users
  set
    encrypted_password = crypt(new_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = target_id;

  raise notice 'Senha atualizada para %. Faça login e invalide sessões antigas se necessário.', admin_email;
end $$;
