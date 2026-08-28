# Smoke tests de segurança (API direta)

Use a anon key do projeto (a mesma do frontend). Não use a service role.

**Automatizado:** `npm run security:smoke` (lê `.env.local` ou variáveis de ambiente).

Substitua `URL` e `ANON` nos exemplos abaixo.

## 1. Anon — leitura pública OK

```js
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(URL, ANON)

const { data: products } = await supabase
  .from('products')
  .select('id, name, product_variants(id, size_label, in_stock, quantity)')
  .eq('status', 'active')

// Esperado: products retornam; quantity das variantes deve vir null/ausente para anon
console.log(products?.[0]?.product_variants)
```

## 2. Anon — writes bloqueados

```js
await supabase.from('products').insert({ name: 'hack', slug: 'hack', price: 1 })
// Esperado: erro / RLS

await supabase.from('sales').select('*')
// Esperado: erro ou vazio sem permissão

await supabase.rpc('register_sale', {
  p_customer_name: 'x',
  p_payment_method: 'pix',
  p_notes: null,
  p_sold_at: new Date().toISOString(),
  p_items: [{ variant_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
})
// Esperado: Não autorizado
```

## 3. Signup → não admin

Se signup estiver (indevidamente) aberto:

```js
const { data, error } = await supabase.auth.signUp({
  email: `attacker-${Date.now()}@example.com`,
  password: 'TesteForte!123',
})
// Com signup OFF: erro
// Com signup ON (bug operacional): perfil deve nascer com role=none e RPCs admin devem falhar
```

```js
const authed = createClient(URL, ANON, {
  global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
})
await authed.from('profiles').select('role').single()
// Esperado: role = none

await authed.rpc('adjust_stock', { p_variant_id: '...', p_type: 'entrada', p_quantity: 1 })
// Esperado: Não autorizado
```

## 4. Admin legítimo

Com JWT do dono:

```js
await admin.rpc('register_sale', {
  p_customer_name: 'Cliente teste',
  p_payment_method: 'pix',
  p_notes: 'smoke',
  p_sold_at: new Date().toISOString(),
  p_items: [{ variant_id: VARIANT_ID_COM_ESTOQUE, quantity: 1 }],
})
// Esperado: UUID da venda; unit_price = preço/promo do produto no banco
```

```js
await admin.from('product_variants').update({ quantity: 999 }).eq('id', VARIANT_ID)
// Esperado: erro — só via adjust_stock
```

## 5. Banner link perigoso

```js
await admin.from('banners').update({ button_link: 'javascript:alert(1)' }).eq('id', BANNER_ID)
// Esperado: erro do trigger
```
