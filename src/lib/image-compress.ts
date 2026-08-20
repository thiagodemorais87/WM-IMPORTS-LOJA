import { PRODUCT_IMAGE_MAX_EDGE, PRODUCT_IMAGE_QUALITY } from '@/constants'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    image.src = url
  })
}

/** Redimensiona e comprime no browser para uploads mais leves. */
export async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file

  const image = await loadImage(file)
  const scale = Math.min(1, PRODUCT_IMAGE_MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(image, 0, 0, width, height)

  const preferWebp = file.type === 'image/webp' || file.type === 'image/png'
  const mime = preferWebp ? 'image/webp' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, PRODUCT_IMAGE_QUALITY))
  if (!blob) return file

  const extension = mime === 'image/webp' ? 'webp' : 'jpg'
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${baseName}.${extension}`, { type: mime, lastModified: Date.now() })
}
