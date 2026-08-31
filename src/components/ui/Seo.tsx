import { useEffect } from 'react'
import { APP_NAME, DEFAULT_SEO_DESCRIPTION, SITE_URL } from '@/constants'

const JSON_LD_SCRIPT_ID = 'wm-seo-jsonld'

interface SeoProps {
  title?: string
  description?: string
  image?: string
  path?: string
  robots?: string
  type?: 'website' | 'product'
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>
}

function absoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${SITE_URL}${path}`
}

export function Seo({ title, description, image, path, robots, type = 'website', jsonLd }: SeoProps) {
  const jsonLdSerialized = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const fullTitle = title ? `${title} | ${APP_NAME}` : `${APP_NAME} | Moda e Acessórios`
    const desc = description ?? DEFAULT_SEO_DESCRIPTION
    const pathname = path ?? window.location.pathname
    const url = absoluteUrl(pathname)
    const ogImage = absoluteUrl(image ?? '/logo.png')
    const robotsContent = robots ?? 'index, follow'

    document.title = fullTitle
    setMeta('description', desc)
    setLinkCanonical(url)

    setMeta('og:title', fullTitle, 'property')
    setMeta('og:description', desc, 'property')
    setMeta('og:image', ogImage, 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:type', type, 'property')
    setMeta('og:locale', 'pt_BR', 'property')
    setMeta('og:site_name', APP_NAME, 'property')

    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', fullTitle)
    setMeta('twitter:description', desc)
    setMeta('twitter:image', ogImage)

    setMeta('robots', robotsContent)

    if (jsonLdSerialized) {
      setJsonLd(JSON.parse(jsonLdSerialized) as Record<string, unknown> | Array<Record<string, unknown>>)
    } else {
      removeJsonLd()
    }

    return () => {
      removeJsonLd()
    }
  }, [title, description, image, path, robots, type, jsonLdSerialized])

  return null
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let element = document.head.querySelector(`meta[${attr}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, name)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function setLinkCanonical(href: string) {
  let element = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

function setJsonLd(data: Record<string, unknown> | Array<Record<string, unknown>>) {
  let element = document.getElementById(JSON_LD_SCRIPT_ID) as HTMLScriptElement | null
  if (!element) {
    element = document.createElement('script')
    element.id = JSON_LD_SCRIPT_ID
    element.type = 'application/ld+json'
    document.head.appendChild(element)
  }
  element.textContent = JSON.stringify(data)
}

function removeJsonLd() {
  document.getElementById(JSON_LD_SCRIPT_ID)?.remove()
}
