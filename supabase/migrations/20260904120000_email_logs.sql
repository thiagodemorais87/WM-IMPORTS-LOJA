-- WM Imports — logs de e-mails de pedidos (Resend)

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_email text not null,
  email_type text not null check (email_type in (
    'order_received',
    'payment_confirmed',
    'order_shipped',
    'order_completed'
  )),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index email_logs_order_id_idx on public.email_logs (order_id);
create index email_logs_created_at_idx on public.email_logs (created_at desc);

-- Evita e-mail duplicado com sucesso para o mesmo pedido + tipo
create unique index email_logs_order_type_sent_uidx
  on public.email_logs (order_id, email_type)
  where status = 'sent';

alter table public.email_logs enable row level security;

-- Sem policies públicas: só service role (API server-side) acessa
revoke all on public.email_logs from anon, authenticated;
