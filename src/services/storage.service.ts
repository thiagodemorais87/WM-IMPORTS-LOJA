import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/constants'
import { supabase } from '@/lib/supabase'

export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use imagens JPG, PNG ou WEBP.')
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('A imagem deve ter no máximo 5 MB.')
  }
}

export async function uploadImage(bucket: 'product-images' | 'store-assets', path: string, file: File) {
  validateImageFile(file)
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

export async function removeImage(bucket: 'product-images' | 'store-assets', path: string) {
  if (path.startsWith('seed/')) return
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

export function makeObjectPath(folder: string, file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() === 'jpg' ? 'jpg' : file.type.split('/')[1]
  return `${folder}/${crypto.randomUUID()}.${ext}`
}
