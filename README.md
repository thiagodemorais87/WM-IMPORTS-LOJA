# WM Imports

Loja/catálogo online da **WM Imports**, em Sertânia/PE, com envio para todo o Brasil. O cliente escolhe os produtos e solicita a compra pelo WhatsApp. O administrador gerencia catálogo, imagens, variações, estoque e vendas pelo painel.

> De Sertânia para todo o Brasil.

## Funcionalidades

### Área pública
- Home com carrossel, diferenciais, destaques e categorias
- Catálogo com busca, filtros e ordenação
- Página de produto com galeria, tamanhos e disponibilidade
- Carrinho simples (sem pagamento)
- Solicitação pelo WhatsApp
- Páginas Sobre e Contato

### Área administrativa (`/admin`)
- Login com Supabase Auth (sem cadastro público)
- Dashboard com indicadores e gráficos
- CRUD de produtos, categorias, banners e diferenciais
- Upload de imagens no Supabase Storage
- Controle de estoque por variação/tamanho
- Registro de vendas com baixa atômica de estoque
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
├── lib/          # Cliente Supabase, formatação, WhatsApp
├── contexts/     # Auth, carrinho, configurações
├── types/
├── constants/
└── routes/
```

O frontend não usa Service Role Key. Toda proteção real está no RLS do Postgres.

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

1. Abra o [SQL Editor do projeto](https://supabase.com/dashboard/project/tbgfhfcizzahpcpgukbh/sql/new).
2. Cole e execute o arquivo `supabase/migrations/20260817120000_init_wm_imports.sql`.
3. O seed cria o administrador `xafullt@gmail.com` (senha no final da migration). Entre em `/admin/login`.
4. Desative o cadastro público em Authentication > Providers > Email > *Enable sign ups*.
5. Em Configurações, informe o WhatsApp da loja.

Sem o passo 2 a loja não consegue ler produtos, categorias nem banners.

### 1. Banco, RLS e Storage

No Dashboard do Supabase, abra **SQL Editor** e execute o arquivo:

`supabase/migrations/20260817120000_init_wm_imports.sql`

Esse script cria tabelas, índices, funções de estoque, políticas RLS, buckets de imagens e dados iniciais (categorias, banners, destaques e produtos de exemplo).

Via CLI, depois de autenticado:

```bash
npx supabase login
npx supabase link --project-ref tbgfhfcizzahpcpgukbh
npx supabase db push
```

### 2. Autenticação

1. Em **Authentication > Providers**, mantenha o e-mail habilitado.
2. Em **Authentication > Providers > Email**, desative o cadastro público (*Enable sign ups*).
3. O seed da migration já cria o usuário `xafullt@gmail.com` e o trigger `handle_new_user` gera o perfil `admin`.
4. Troque a senha inicial após o primeiro acesso.

Não existe tela de cadastro para clientes.

### 3. Storage

Os buckets `product-images` e `store-assets` são criados pela migration. Leitura pública, escrita apenas para administradores.

Formatos aceitos: JPG, JPEG, PNG e WEBP. Limite: 5 MB.

### 4. WhatsApp

No painel, acesse **Configurações** e informe o número com DDD. A mensagem padrão também é editável. Sem esse número, o botão de WhatsApp permanece oculto.

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run preview  # pré-visualizar o build
```

## Deploy na Vercel

1. Importe o repositório na Vercel.
2. Framework: Vite.
3. Configure as variáveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. O arquivo `vercel.json` já redireciona todas as rotas para `index.html`, para o React Router funcionar após refresh em `/produtos`, `/produto/:id` e `/admin`.

## Segurança

- RLS ativo em todas as tabelas de negócio
- Catálogo público lê apenas produtos `active`
- Vendas, estoque e configurações de escrita: somente `profiles.role = 'admin'`
- Baixa de estoque feita por função SQL com lock (`register_sale` / `adjust_stock`)
- Credenciais administrativas não vão para o frontend
- `.env` está no `.gitignore`

## Identidade visual

A interface segue a logo cromada da WM Imports: fundo preto, prata/platina, tipografia geométrica e estética de moda contemporânea. A logo original está em `public/logo.png` e `src/assets/logo.png`.
