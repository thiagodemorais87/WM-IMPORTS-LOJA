# Checklist de produção — WM Imports

## Antes do go-live

- [ ] Migration inicial + `20260826000000_security_hardening.sql` aplicadas
- [ ] Sign-ups desabilitados no Supabase Cloud
- [ ] Confirmação de e-mail habilitada (recomendado)
- [ ] Captcha Auth habilitado (recomendado)
- [ ] Senha do admin rotacionada (não é a senha antiga do Git)
- [ ] `bootstrap_admin.sql` executado só para o e-mail do dono
- [ ] `select email, role from profiles` revisado — sem admins extras
- [ ] Sem senhas/e-mails reais em arquivos versionados
- [ ] Variáveis Vercel: só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (anon)
- [ ] Deploy Vercel com `vercel.json` (headers)
- [ ] `curl -I https://seu-dominio` mostra CSP, HSTS, X-Frame-Options, nosniff
- [ ] Smoke tests de [security-smoke-tests.md](security-smoke-tests.md) OK
- [ ] WhatsApp configurado no painel
- [ ] Backup / PITR ou dump agendado no Supabase

## Monitoramento contínuo

- [ ] Revisar Auth logs (tentativas de login) no Dashboard
- [ ] Acesso ao SQL Editor restrito à equipe
- [ ] `npm audit` periódico (sem upgrades cegos)
- [ ] Não reativar sign-ups sem revisar o modelo de roles

## Pós-deploy

- [ ] Login admin funciona
- [ ] Vitrine carrega produtos
- [ ] Carrinho gera mensagem WhatsApp sem preço
- [ ] Registrar venda de teste e confirmar estoque + preço do catálogo
- [ ] Tentativa anon de insert produto falha
