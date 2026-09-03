/**
 * Smoke tests de segurança — WM Imports
 * Uso: npm run security:smoke
 * Requer VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (env ou .env.local).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename)
  if (!existsSync(path)) return

  const content = readFileSync(path, 'utf8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const supabase = createClient(url, anonKey)
let failed = 0

function pass(label) {
  console.log(`OK  ${label}`)
}

function fail(label, detail) {
  failed += 1
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`)
}

async function expectError(label, action) {
  try {
    const result = await action()
    const hasError = result?.error
    if (hasError) {
      pass(label)
      return
    }
    fail(label, 'esperava erro RLS/permissão')
  } catch {
    pass(label)
  }
}

console.log('WM Imports — security smoke tests\n')

const { data: products, error: productsError } = await supabase
  .from('products')
  .select('id, name, product_variants(id, size_label, in_stock, quantity, max_request_qty)')
  .eq('status', 'active')
  .limit(1)

if (productsError) {
  fail('Anon lê produtos ativos', productsError.message)
} else {
  pass('Anon lê produtos ativos')
  const variant = products?.[0]?.product_variants?.[0]
  if (variant && 'quantity' in variant && variant.quantity != null) {
    fail('Anon não expõe quantity bruto', `quantity=${variant.quantity}`)
  } else {
    pass('Anon não expõe quantity bruto')
  }
  if (variant && variant.max_request_qty != null) {
    pass('Anon expõe max_request_qty (coluna pública)')
  }
}

await expectError('Anon insert produto bloqueado', () =>
  supabase.from('products').insert({ name: 'hack', slug: `hack-${Date.now()}`, price: 1 }),
)

await expectError('Anon select sales bloqueado', () => supabase.from('sales').select('*').limit(1))

await expectError('Anon select orders bloqueado', () => supabase.from('orders').select('*').limit(1))

await expectError('Anon select order_events bloqueado', () =>
  supabase.from('order_events').select('*').limit(1),
)

await expectError('Anon select email_logs bloqueado', () =>
  supabase.from('email_logs').select('*').limit(1),
)

await expectError('Anon insert orders bloqueado', () =>
  supabase.from('orders').insert({
    order_number: `TEST-${Date.now()}`,
    customer_name: 'Teste',
    customer_phone: '87999999999',
    customer_email: 'teste@example.com',
    status: 'pending_payment',
    total_amount: 0,
  }),
)

await expectError('Anon RPC create_order payload inválido', () =>
  supabase.rpc('create_order', {
    p_customer_name: '',
    p_customer_phone: '123',
    p_customer_email: 'invalido',
    p_notes: null,
    p_items: [],
  }),
)

await expectError('Anon RPC confirm_order_payment bloqueado', () =>
  supabase.rpc('confirm_order_payment', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_payment_method: 'pix',
  }),
)

await expectError('Anon RPC update_order bloqueado', () =>
  supabase.rpc('update_order', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_customer_name: 'Teste',
    p_customer_phone: '87999999999',
    p_customer_email: 'teste@example.com',
    p_notes: null,
    p_discount_amount: 0,
    p_items: [],
  }),
)

await expectError('Anon RPC cancel_order bloqueado', () =>
  supabase.rpc('cancel_order', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
  }),
)

await expectError('Anon RPC update_order_status bloqueado', () =>
  supabase.rpc('update_order_status', {
    p_order_id: '00000000-0000-0000-0000-000000000000',
    p_status: 'preparing',
  }),
)

await expectError('Anon RPC register_sale bloqueado', () =>
  supabase.rpc('register_sale', {
    p_customer_name: 'x',
    p_payment_method: 'pix',
    p_notes: null,
    p_sold_at: new Date().toISOString(),
    p_items: [{ variant_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
  }),
)

await expectError('Anon RPC adjust_stock bloqueado', () =>
  supabase.rpc('adjust_stock', {
    p_variant_id: '00000000-0000-0000-0000-000000000000',
    p_type: 'entrada',
    p_quantity: 1,
    p_notes: 'smoke',
  }),
)

console.log('')
if (failed > 0) {
  console.error(`${failed} teste(s) falharam.`)
  process.exit(1)
}

console.log('Todos os smoke tests passaram.')
process.exit(0)
