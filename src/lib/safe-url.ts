/** Links seguros para banners e CTAs da vitrine */
export function isSafeBannerLink(link: string | null | undefined): boolean {
  if (link == null) return true
  const value = link.trim()
  if (!value) return true
  const lower = value.toLowerCase()
  if (lower === 'whatsapp') return true
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false
  }
  if (value.startsWith('/')) return !value.startsWith('//')
  if (lower.startsWith('https://')) return true
  if (lower.startsWith('http://')) return true
  return false
}

export function sanitizeBannerLink(link: string | null | undefined): string | null {
  if (link == null) return null
  const value = link.trim()
  if (!value) return null
  if (!isSafeBannerLink(value)) {
    throw new Error('Link inválido. Use /caminho, https://..., http://... ou whatsapp.')
  }
  return value
}

/** Redirect pós-login: apenas paths internos do painel */
export function safeAdminRedirect(path: string | null | undefined, fallback = '/admin'): string {
  if (!path) return fallback
  if (!path.startsWith('/admin')) return fallback
  if (path.startsWith('//') || path.includes('\\')) return fallback
  return path
}
