# Configuração Resend — WM Imports

E-mails de pedidos são enviados **somente no servidor** (`/api/orders/email`). A `RESEND_API_KEY` **nunca** vai para o frontend.

## Variáveis de ambiente (Vercel / `vercel dev`)

| Variável | Onde | Descrição |
|----------|------|-----------|
| `RESEND_API_KEY` | Server only | Chave da API Resend (já configurada na Vercel) |
| `RESEND_FROM_EMAIL` | Server only | Remetente verificado: `WM Imports <pedidos@wmimportspe.com.br>` |
| `SUPABASE_URL` | Server only | URL do projeto Supabase (fallback: `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service role — **nunca** no browser |
| `VITE_SUPABASE_URL` | Frontend | Já existente |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Já existente |

Configure em **Vercel → Project → Settings → Environment Variables** (Production e Preview).

**Não** duplicar `RESEND_API_KEY`. **Não** usar prefixo `VITE_` nas variáveis server-only.

## Domínio verificado

O domínio `wmimportspe.com.br` está verificado no Resend com SPF/DKIM validados.

Remetente de produção:

```
WM Imports <pedidos@wmimportspe.com.br>
```

Sem domínio verificado ou com `RESEND_FROM_EMAIL` incorreto, o Resend rejeita o envio; o pedido **continua normal** e o erro fica em `email_logs`.

## Fluxo de envio

```
Cliente cria pedido → Supabase → WhatsApp + Resend (order_received)
Admin confirma pagamento → estoque baixado → Resend (payment_confirmed)
Admin marca Enviado → Resend (order_shipped)
Admin marca Concluído → Resend (order_completed)
```

## Migrations

Aplique (nesta ordem, após `orders`):

1. `20260904120000_email_logs.sql`
2. `20260905120000_order_events.sql`
3. `20260905130000_order_events_logging.sql`

## Eventos que disparam e-mail

| Evento | Tipo | Destinatário |
|--------|------|--------------|
| Checkout cria pedido | `order_received` | E-mail do cliente |
| Admin confirma pagamento | `payment_confirmed` | E-mail do cliente |
| Status → Enviado | `order_shipped` | E-mail do cliente |
| Status → Concluído | `order_completed` | E-mail do cliente |

Não há e-mail em: edição, cancelamento, “Em preparação”.

## Como testar (integração real)

1. Aplique as migrations no Supabase
2. Confirme na Vercel: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. Rode `vercel dev` (Vite puro **não** executa `api/*`) ou faça deploy preview
4. Checkout com seu e-mail → inbox com remetente `pedidos@wmimportspe.com.br` + `email_logs` (`order_received` / `sent` / `provider_id` preenchido)
5. Admin: confirmar pagamento → e-mail `payment_confirmed` via Resend
6. Avançar status até Enviado e Concluído → e-mails 3 e 4 via Resend
7. Repetir o mesmo tipo → resposta `skipped` (índice único anti-duplicação)
8. Remover `RESEND_API_KEY` temporariamente → pedido/pagamento seguem ok; e-mail `skipped`/`failed`

Verificação SQL:

```sql
select email_type, status, provider_id, customer_email, error_message
from public.email_logs
where order_id = '<uuid>'
order by created_at;
```

## Comportamento em falha

- Pedido, pagamento, estoque e venda **não** são revertidos
- Erros são logados no servidor e gravados em `email_logs` (`failed` / `skipped`)
- Envios bem-sucedidos registram evento `email_sent` em `order_events`
- O frontend ignora falhas de e-mail (fire-and-forget)
