import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    return null
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function getSupabaseAuthClient(accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey || !accessToken) {
    return null
  }

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function assertIsAdmin(accessToken) {
  const client = getSupabaseAuthClient(accessToken)
  if (!client) {
    return { ok: false, error: 'Auth não configurado' }
  }

  const { data: userData, error: userError } = await client.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return { ok: false, error: 'Não autenticado' }
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError || profile?.role !== 'admin') {
    return { ok: false, error: 'Não autorizado' }
  }

  return { ok: true, userId: userData.user.id }
}
