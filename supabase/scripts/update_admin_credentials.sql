-- =============================================================================
-- WM Imports — atualizar e-mail e senha do administrador (produção)
-- =============================================================================
-- Executar UMA vez no SQL Editor do Supabase.
-- Novo login: william_mirog@hotmail.com / 253467aZ@
-- =============================================================================

create extension if not exists "pgcrypto";

do $$
declare
  old_email text := 'xafullt@gmail.com';
  new_email text := 'william_mirog@hotmail.com';
  new_password text := '253467aZ@';
  target_id uuid;
begin
  -- Se o novo e-mail já existe, só atualiza a senha e o metadado
  select id into target_id from auth.users where email = new_email limit 1;

  if target_id is not null then
    update auth.users
    set
      encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', 'William Mirog'),
      updated_at = now()
    where id = target_id;

    update auth.identities
    set
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object(
        'email', new_email,
        'email_verified', true,
        'sub', target_id::text
      ),
      updated_at = now()
    where user_id = target_id and provider = 'email';

    return;
  end if;

  -- Migra o admin antigo (se existir)
  select id into target_id from auth.users where email = old_email limit 1;

  if target_id is not null then
    update auth.users
    set
      email = new_email,
      encrypted_password = crypt(new_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', 'William Mirog'),
      updated_at = now()
    where id = target_id;

    update auth.identities
    set
      identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object(
        'email', new_email,
        'email_verified', true,
        'sub', target_id::text
      ),
      updated_at = now()
    where user_id = target_id and provider = 'email';

    return;
  end if;

  -- Nenhum dos dois existe: cria o admin do zero
  target_id := gen_random_uuid();

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
    target_id,
    'authenticated',
    'authenticated',
    new_email,
    crypt(new_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', 'William Mirog'),
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
    target_id,
    target_id::text,
    jsonb_build_object(
      'sub', target_id::text,
      'email', new_email,
      'email_verified', true
    ),
    'email',
    now(),
    now(),
    now()
  );
end $$;
