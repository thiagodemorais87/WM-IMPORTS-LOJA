# Checklist de produção — WM Imports

## Supabase Cloud (obrigatório pós-deploy)

Espelhe o que está em [`supabase/config.toml`](../supabase/config.toml) e valide no Dashboard:

- [ ] **Migrations aplicadas** (SQL Editor ou `supabase db push`):
  - `20260817120000_init_wm_imports.sql`
  - `20260826000000_security_hardening.sql`
  - `20260827000000_adjust_stock_allow_zero.sql`
  - `20260828000000_public_max_request_qty.sql`
  - `20260829100000_revert_mfa_requirement.sql` (se `require_mfa_for_admin` foi aplicada antes)
- [ ] **Authentication → Providers → Email**: **Enable sign ups = OFF**
- [ ] **Authentication → Rate Limits**: sign-in ≈ 10 tentativas / 5 min por IP
- [ ] **Authentication → Attack Protection**: proteção contra senhas vazadas habilitada
- [ ] **Authentication → Email**: confirmação de e-mail habilitada
- [ ] **Authentication → Bot Protection**: captcha **desligado** (proteção via rate limits + RLS)
- [ ] **Authentication → Sessions** (opcional): inactivity timeout (ex.: 8h)
- [ ] **Database → Backups**: PITR ou dump agendado
- [ ] `select email, role from public.profiles` — sem admins extras

## Vercel / frontend

- [ ] Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [ ] **Nunca** commitar `service_role` no frontend
- [ ] Deploy com [`vercel.json`](../vercel.json) (headers de segurança)
- [ ] `curl -I https://seu-dominio` mostra CSP, HSTS, X-Frame-Options, nosniff

## Segurança e admin

- [ ] Senha do admin rotacionada (não é senha antiga do Git)
- [ ] `bootstrap_admin.sql` executado só para o e-mail do dono
- [ ] `npm run security:smoke` OK contra produção/staging
- [ ] Smoke tests manuais: [security-smoke-tests.md](security-smoke-tests.md)

## Antes do go-live (funcional)

- [ ] Sem senhas/e-mails reais em arquivos versionados
- [ ] WhatsApp configurado no painel

## Monitoramento contínuo

- [ ] Revisar Auth logs (tentativas de login) no Dashboard
- [ ] Acesso ao SQL Editor restrito à equipe
- [ ] `npm audit` periódico (sem upgrades cegos)
- [ ] Não reativar sign-ups sem revisar o modelo de roles
- [ ] CI (`.github/workflows/security.yml`) verde após cada push

## Pós-deploy

- [ ] Login admin funciona
- [ ] Vitrine carrega produtos
- [ ] Carrinho gera mensagem WhatsApp sem preço
- [ ] Registrar venda de teste e confirmar estoque + preço do catálogo
- [ ] Tentativa anon de insert produto falha
- [ ] `/robots.txt` bloqueia `/admin`
