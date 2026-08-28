import { useEffect } from 'react'
import { APP_NAME, DEFAULT_SEO_DESCRIPTION } from '@/constants'

interface SeoProps {
  title?: string
  description?: string
  image?: string
  path?: string
  robots?: string
}

export function Seo({ title, description, image, path, robots }: SeoProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${APP_NAME}` : `${APP_NAME} | Moda e Acessórios`
    const desc = description ?? DEFAULT_SEO_DESCRIPTION
    const url = `${window.location.origin}${path ?? window.location.pathname}`
    const ogImage = image ?? `${window.location.origin}/logo.png`

    document.title = fullTitle
    setMeta('description', desc)
    setMeta('og:title', fullTitle, 'property')
    setMeta('og:description', desc, 'property')
    setMeta('og:image', ogImage, 'property')
    setMeta('og:url', url, 'property')
    setMeta('og:type', 'website', 'property')
    setMeta('twitter:card', 'summary_large_image')
    if (robots) {
      setMeta('robots', robots)
    } else {
      removeMeta('robots')
    }
  }, [title, description, image, path, robots])

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

function removeMeta(name: string, attr: 'name' | 'property' = 'name') {
  document.head.querySelector(`meta[${attr}="${name}"]`)?.remove()
}
