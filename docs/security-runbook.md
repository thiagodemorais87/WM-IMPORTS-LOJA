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

## Rotacionar senha

Preferência: Dashboard → Users → usuário → **Send password recovery** ou redefinir senha.

Alternativa controlada: `supabase/scripts/update_admin_credentials.sql` com placeholders locais — **nunca** commitar senha real.

Após rotação: peça logout em todos os dispositivos / invalide refresh tokens no Dashboard se disponível.

## Aplicar hardening em projeto já existente

1. Rode `supabase/migrations/20260826000000_security_hardening.sql`.
2. Confirme que o admin legítimo ainda tem `role = 'admin'`.
3. Se necessário, rode `bootstrap_admin.sql` só para o e-mail do dono.
4. Smoke tests: [security-smoke-tests.md](security-smoke-tests.md).

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
