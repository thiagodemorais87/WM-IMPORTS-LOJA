# WM Imports

Loja/catálogo online da **WM Imports**, em Sertânia/PE, com envio para todo o Brasil. O cliente escolhe os produtos e solicita a compra pelo WhatsApp. O administrador gerencia catálogo, imagens, variações, estoque e vendas pelo painel.

> De Sertânia para todo o Brasil.

## Funcionalidades

### Área pública
- Home com carrossel, diferenciais, destaques e categorias
- Catálogo com busca, filtros e ordenação
- Página de produto com galeria, tamanhos e disponibilidade
- Carrinho simples (intenção de compra, sem pagamento)
- Solicitação pelo WhatsApp
- Páginas Sobre e Contato

### Área administrativa (`/admin`)
- Login com Supabase Auth (sem cadastro público)
- Dashboard com indicadores e gráficos
- CRUD de produtos, categorias, banners e diferenciais
- Upload de imagens no Supabase Storage
- Controle de estoque por variação/tamanho
- Registro de vendas com baixa atômica de estoque e preço calculado no servidor
- Histórico de movimentações
- Configurações da loja (WhatsApp, Instagram, limite de estoque baixo, textos)

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- React Router
- Supabase (PostgreSQL, Auth, Storage, RLS)
- Motion (animações no estilo React Bits)
- Recharts, Embla Carousel, Lucide, Sonner
- Deploy na Vercel (frontend) e Supabase (backend)

## Arquitetura

```text
src/
├── components/   # UI, layout, bits, catálogo e admin
├── pages/        # Páginas públicas e administrativas
├── layouts/      # Shell público e do painel
├── hooks/
├── services/     # Chamadas ao Supabase e regras de negócio
├── lib/          # Cliente Supabase, formatação, WhatsApp, URLs seguras
├── contexts/     # Auth, carrinho, configurações
├── types/
├── constants/
└── routes/
```

O frontend não usa Service Role Key. Toda proteção real está no RLS do Postgres e nas RPCs.

## Configuração local

1. Instale o Node.js 20+.
2. Copie as variáveis de ambiente:

```bash
cp .env.example .env
```

3. Preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publicavel
```

Use somente a **anon/publishable key**. Nunca coloque a Service Role Key no frontend ou no Git.

4. Instale e execute:

```bash
npm install
npm run dev
```

A loja abre em `http://localhost:5173`.

## Primeiro uso (obrigatório)

1. No SQL Editor do Supabase, execute nesta ordem:
   - `supabase/migrations/20260817120000_init_wm_imports.sql`
   - `supabase/migrations/20260826000000_security_hardening.sql`
2. Em **Authentication > Providers > Email**, desative *Enable sign ups*.
3. Crie o usuário admin em **Authentication > Users > Add user** (defina e-mail e senha forte no Dashboard — nunca use senhas de exemplos do Git).
4. Execute `supabase/scripts/bootstrap_admin.sql` com o e-mail do dono (WHERE explícito; sem UPDATE massivo).
5. Confirme: `select id, email, role from public.profiles where role = 'admin';`
6. Entre em `/admin/login` e configure o WhatsApp em Configurações.

Via CLI (após `npx supabase login` e `link`):

```bash
npx supabase db push
```

### Autenticação (produção)

1. Sign-ups **desabilitados**.
2. Confirmação de e-mail recomendada.
3. Senha forte (mín. 12 caracteres) — alinhar no Dashboard com o `config.toml` local.
4. Smoke tests: `npm run security:smoke` (ver [docs/security-runbook.md](docs/security-runbook.md)).
5. Rotacione a senha se ela já tiver aparecido em commits antigos do repositório.
6. Promoção a admin **somente** via `bootstrap_admin.sql` (ou SQL Editor com flag controlada).

Não existe tela de cadastro para clientes. O trigger `handle_new_user` cria perfil com `role = 'none'` (sem privilégios).

### Storage

Buckets `product-images` e `store-assets`: leitura pública, escrita apenas admin. JPG/PNG/WEBP, 5 MB.

### WhatsApp

Configure o número no painel. Sem número, os botões de WhatsApp ficam ocultos/desabilitados.

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run preview  # pré-visualizar o build
```

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Framework: Vite.
3. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. `vercel.json` faz rewrite SPA e envia security headers (CSP, HSTS, etc.). Após o deploy, valide com `curl -I https://seu-dominio`.

## Segurança

Documentação operacional:

- [docs/security-runbook.md](docs/security-runbook.md) — criar admin, rotacionar senha, checklist
- [docs/security-smoke-tests.md](docs/security-smoke-tests.md) — testes manuais API
- [docs/production-checklist.md](docs/production-checklist.md) — go-live

Resumo:

- RLS em todas as tabelas de negócio
- Catálogo público sem `quantity` exata (usa `in_stock`)
- Vendas/estoque mutáveis só via RPCs (`register_sale` / `adjust_stock`)
- Preço da venda calculado no servidor
- Roles: `none` | `admin` — escalação bloqueada na API
- Sem Service Role no frontend
- Headers de segurança no deploy Vercel

## Identidade visual

Fundo preto, prata/platina, tipografia Outfit/Syne. Logo em `public/logo.png` e `src/assets/logo.png`.
