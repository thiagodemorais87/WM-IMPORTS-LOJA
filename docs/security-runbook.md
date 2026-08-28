# Runbook de segurança — WM Imports

## Criar / promover o administrador

1. No Supabase Dashboard → **Authentication → Providers → Email**: desative **Enable sign ups**.
2. **Authentication → Users → Add user**: crie o e-mail do dono com senha forte (≥ 12 caracteres, maiúsculas, minúsculas, números e símbolo).
3. Abra o SQL Editor e execute `supabase/scripts/bootstrap_admin.sql` após substituir `SEU_EMAIL_ADMIN_AQUI`.
4. Verifique:

```sql
select id, email, role, name from public.profiles order by created_at;
```

Deve existir **exatamente** o(s) admin(s) pretendido(s). Não rode `update profiles set role = 'admin'` sem `where`.

## Reverter exigência de 2FA no banco

Se você aplicou `20260829000000_require_mfa_for_admin.sql`, rode no SQL Editor:

`supabase/migrations/20260829100000_revert_mfa_requirement.sql`

Isso restaura `is_admin()` para aceitar login só com senha (sem JWT `aal2`).

Opcional no Dashboard: **Authentication → MFA → TOTP OFF** e remova fatores MFA do usuário admin.

## Rotacionar senha

Preferência: Dashboard → Users → usuário → **Send password recovery** ou redefinir senha.

Alternativa controlada: `supabase/scripts/update_admin_credentials.sql` com placeholders locais — **nunca** commitar senha real.

Após rotação: peça logout em todos os dispositivos / invalide refresh tokens no Dashboard se disponível.

## Aplicar hardening em projeto já existente

1. Rode `supabase/migrations/20260826000000_security_hardening.sql`.
2. Confirme que o admin legítimo ainda tem `role = 'admin'`.
3. Se necessário, rode `bootstrap_admin.sql` só para o e-mail do dono.
4. Smoke tests: `npm run security:smoke` ou [security-smoke-tests.md](security-smoke-tests.md).

## Rate limiting (login admin)

### No código (frontend)

- Após **5** tentativas incorretas no mesmo e-mail, o navegador bloqueia o formulário por **15 minutos** (`localStorage`).
- Erros **429** do Supabase Auth exibem: *"Muitas tentativas. Aguarde alguns minutos e tente novamente."*
- Constantes em `src/constants/index.ts`: `ADMIN_LOGIN_MAX_ATTEMPTS`, `ADMIN_LOGIN_LOCKOUT_MS`.
- Inatividade no painel: logout após **30 min** (`ADMIN_SESSION_INACTIVITY_MS`).

### No Supabase (produção)

1. Dashboard → **Authentication → Rate Limits**: confirme limites de sign-in por IP (padrão hospedado ≈ 10 tentativas / 5 min).
2. Local/dev: `supabase/config.toml` → `[auth.rate_limit]` → `sign_in_sign_ups`.
3. Mantenha **Enable sign ups** desligado (seção acima).

O bloqueio local protege a UX neste navegador; o limite do Auth protege a API contra brute force distribuído.

## O que o código NÃO faz

- Não promove ninguém a admin pelo frontend (`ensureProfile` só cria `role = 'none'`).
- Não confia em `unit_price` do cliente em vendas.
- Não permite `PATCH` de `quantity` fora das RPCs.

## Incidentes

| Sintoma | Ação |
|---|---|
| Conta desconhecida com `role = admin` | Demover: só via SQL com `set_config('wm.allow_role_change','1',true)` + `update ... where id = '...'` |
| Signup ainda aberto | Desligar no Dashboard imediatamente |
| Senha antiga no Git | Rotacionar agora; considerar limpeza de histórico se o repo for público |
| Admin bloqueado após migration MFA antiga | Rode `20260829100000_revert_mfa_requirement.sql` no SQL Editor |
