# Checklist E2E — Pedidos WM Imports

Checklist manual dos 20 testes de ponta a ponta do fluxo de pedidos. Execute em **staging/preview** ou produção após deploy, com migrations aplicadas.

## Pré-requisitos

- [ ] Migrations aplicadas: `orders`, `orders_admin`, `email_logs`, `order_events`, `order_events_logging`
- [ ] Variáveis Vercel: `RESEND_API_KEY`, `RESEND_FROM_EMAIL=WM Imports <pedidos@wmimportspe.com.br>`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Admin autenticado em `/admin/pedidos`
- [ ] Produto ativo com estoque ≥ 2 unidades para testes

## Regra de faturamento (referência)

Pedidos válidos para KPIs: `status IN ('paid', 'preparing', 'shipped', 'completed')`.

Excluídos: `pending_payment`, `cancelled`.

---

## 1–5 — Fluxo cliente

| # | Teste | Verificar | OK/FALHA |
|---|-------|-----------|----------|
| 1 | Checkout no site | Pedido criado com status `pending_payment` | |
| 2 | Admin lista pedidos | Aparece em `/admin/pedidos` | |
| 3 | WhatsApp | Link/mensagem abre com número e itens corretos | |
| 4 | E-mail `order_received` via Resend | `email_logs.status = 'sent'` + `provider_id` preenchido (ID Resend) | |
| 5 | Inbox cliente (Resend) | E-mail recebido; remetente `pedidos@wmimportspe.com.br`; conteúdo com nº pedido, itens, quantidades, valores unitários, total e status | |

**SQL — pedido criado:**
```sql
select order_number, status, total_amount from public.orders
order by created_at desc limit 1;
```

**SQL — e-mail Resend:**
```sql
select email_type, status, provider_id, customer_email, error_message, created_at
from public.email_logs
where order_id = '<uuid>'
order by created_at;
```

---

## 6–8 — Edição

| # | Teste | Verificar | OK/FALHA |
|---|-------|-----------|----------|
| 6 | Editar itens (pending) | Total recalculado; estoque **não** alterado | |
| 7 | Editar cliente/desconto | Dados salvos; evento `order_edited` no histórico | |
| 8 | Estoque pending | `product_variants.quantity` inalterado após edição pending | |

**SQL — estoque inalterado (pending):**
```sql
select pv.size_label, pv.quantity from public.product_variants pv
where pv.id = '<variant_id>';
```

---

## 9–11 — Pagamento

| # | Teste | Verificar | OK/FALHA |
|---|-------|-----------|----------|
| 9 | Confirmar pagamento | `sale_id` preenchido; status `paid`; `paid_at` setado | |
| 10 | Estoque baixado | Quantidade reduzida; `stock_movements` tipo `venda` | |
| 11 | E-mail `payment_confirmed` via Resend | `email_logs` com `sent` + `provider_id`; evento `email_sent`; inbox do cliente com remetente `pedidos@wmimportspe.com.br` | |

**SQL — venda e estoque:**
```sql
select o.status, o.sale_id, o.paid_at, s.total
from public.orders o
left join public.sales s on s.id = o.sale_id
where o.id = '<uuid>';
```

---

## 12–15 — Status + e-mails

| # | Teste | Verificar | OK/FALHA |
|---|-------|-----------|----------|
| 12 | paid → preparing | Status atualizado; evento `status_changed` | |
| 13 | preparing → shipped | E-mail `order_shipped` enviado via Resend; `provider_id` + inbox | |
| 14 | shipped → completed | E-mail `order_completed` enviado via Resend; `provider_id` + inbox | |
| 15 | Histórico admin | Eventos + logs de e-mail visíveis em `/admin/pedidos/:id` (complementa verificação Resend dos testes 11/13/14) | |

---

## 16–19 — Regras de negócio

| # | Teste | Verificar | OK/FALHA |
|---|-------|-----------|----------|
| 16 | Cancelado fora do faturamento | Dashboard **não** inclui pedido cancelado no faturamento | |
| 17 | Pending fora do faturamento | Dashboard **não** inclui pending no faturamento | |
| 18 | Edição pedido pago | Delta de estoque correto (aumento/diminuição) | |
| 19 | Estoque ≥ 0 | Nunca fica negativo após operações | |

**SQL — faturamento dashboard (pedidos válidos):**
```sql
select count(*), sum(total_amount)
from public.orders
where status in ('paid', 'preparing', 'shipped', 'completed')
  and date(coalesce(paid_at, created_at) at time zone 'America/Sao_Paulo') = current_date;
```

---

## 20 — Segurança

| # | Teste | Verificar | OK/FALHA |
|---|-------|-----------|----------|
| 20 | RLS + RPCs | `npm run security:smoke` passa; anon bloqueado em orders/events | |

---

## Verificações adicionais

### Duplicata de e-mail
```sql
select order_id, email_type, count(*)
from public.email_logs
where status = 'sent'
group by 1, 2 having count(*) > 1;
-- Esperado: 0 linhas
```

### Eventos do pedido
```sql
select event_type, message, created_at
from public.order_events
where order_id = '<uuid>'
order by created_at desc;
```

### API keys no frontend
```bash
rg "RESEND_API_KEY|SERVICE_ROLE" src/
# Esperado: nenhum resultado
```

---

## Redirect de compatibilidade

- [ ] `/admin/orders` → `/admin/pedidos`
- [ ] `/admin/orders/:id` → `/admin/pedidos/:id`
- [ ] Dashboard card "Aguardando pagamento" → `/admin/pedidos?status=pending_payment`

---

## Resultado final

| Área | Status |
|------|--------|
| Fluxo cliente (1–5) | |
| Edição (6–8) | |
| Pagamento (9–11) | |
| Status/e-mails (12–15) | |
| Regras negócio (16–19) | |
| Segurança (20) | |

**Pendências conhecidas:** domínio `wmimportspe.com.br` já verificado; confirmar `RESEND_FROM_EMAIL` na Vercel após redeploy.
