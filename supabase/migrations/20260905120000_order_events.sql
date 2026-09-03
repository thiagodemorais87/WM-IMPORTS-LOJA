-- WM Imports — histórico de eventos de pedidos

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  event_type text not null check (event_type in (
    'order_created',
    'order_edited',
    'payment_confirmed',
    'order_cancelled',
    'status_changed',
    'stock_changed',
    'email_sent'
  )),
  message text not null,
  metadata jsonb,
  user_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index order_events_order_id_idx on public.order_events (order_id);
create index order_events_created_at_idx on public.order_events (created_at desc);

alter table public.order_events enable row level security;

create policy order_events_admin_select on public.order_events
  for select to authenticated
  using (public.is_admin());

revoke all on public.order_events from anon, authenticated;
grant select on public.order_events to authenticated;

-- Admin pode ler logs de e-mail no detalhe do pedido
create policy email_logs_admin_select on public.email_logs
  for select to authenticated
  using (public.is_admin());

grant select on public.email_logs to authenticated;
