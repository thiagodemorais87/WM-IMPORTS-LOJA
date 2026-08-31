const SITE_URL = 'https://wmimportspe.com.br'

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function urlEntry(loc, changefreq, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

module.exports = async function handler(_req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const entries = [
    urlEntry(`${SITE_URL}/`, 'daily', '1.0'),
    urlEntry(`${SITE_URL}/produtos`, 'daily', '0.9'),
    urlEntry(`${SITE_URL}/sobre`, 'monthly', '0.6'),
    urlEntry(`${SITE_URL}/contato`, 'monthly', '0.6'),
  ]

  if (supabaseUrl && supabaseKey) {
    try {
      const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products?select=slug,updated_at&status=eq.active&order=updated_at.desc`
      const response = await fetch(endpoint, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })

      if (response.ok) {
        const products = await response.json()
        for (const product of products) {
          if (!product?.slug) continue
          entries.push(urlEntry(`${SITE_URL}/produto/${product.slug}`, 'weekly', '0.8'))
        }
      }
    } catch {
      // Mantém ao menos as páginas estáticas se o catálogo falhar.
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
  res.status(200).send(xml)
}
