const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'webp'])
const UPLOAD_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'webp'])
const AVIF_BRANDS = new Set(['avif', 'avis'])

export const UPLOAD_ACCEPT =
  'image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp,.png,.jpg,.jpeg,.gif,.webp,.avif,.bmp'

export function validateImage(file: File): string | null {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return '出于安全考虑，不支持上传 SVG'
  }
  if (file.type && !file.type.startsWith('image/')) return '仅支持图片文件'
  if (file.size > MAX_IMAGE_SIZE) return '图片不能超过 10 MB'
  if (file.size === 0) return '图片内容为空'
  return null
}

export async function detectImageExtension(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const is = (...signature: number[]) => signature.every((value, index) => bytes[index] === value)
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length))

  if (is(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png'
  if (is(0xff, 0xd8, 0xff)) return 'jpg'
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'webp'
  if (ascii(0, 2) === 'BM') return 'bmp'
  if (ascii(4, 4) === 'ftyp') {
    const majorBrand = ascii(8, 4)
    if (AVIF_BRANDS.has(majorBrand)) return 'avif'
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      if (AVIF_BRANDS.has(ascii(offset, 4))) return 'avif'
    }
  }
  return null
}

export function ensureImageExtension(fileName: string, extension: string): string {
  const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension
  const currentExtension = fileName.split('.').pop()?.toLowerCase()
  if (currentExtension && UPLOAD_EXTENSIONS.has(currentExtension)) return fileName
  return `${fileName.replace(/\.+$/g, '')}.${normalizedExtension}`
}

export function replaceFileExtension(fileName: string, extension: string): string {
  const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension
  const lastDot = fileName.lastIndexOf('.')
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName.replace(/\.+$/g, '')
  return `${base}.${normalizedExtension}`
}

export function deduplicateFileName(fileName: string, existingLowerNames: Set<string>): string {
  if (!existingLowerNames.has(fileName.toLowerCase())) return fileName
  const lastDot = fileName.lastIndexOf('.')
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName
  const ext = lastDot > 0 ? fileName.slice(lastDot) : ''
  let index = 2
  let candidate = `${base}-${index}${ext}`
  while (existingLowerNames.has(candidate.toLowerCase())) {
    index += 1
    candidate = `${base}-${index}${ext}`
  }
  return candidate
}

export function isImageContent(name: string): boolean {
  const extension = name.split('.').pop()?.toLowerCase()
  return extension ? IMAGE_EXTENSIONS.has(extension) : false
}

export function createUploadName(fileName: string, mode: 'random' | 'original'): string {
  if (mode === 'original') return sanitizeFileName(fileName)
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()?.toLowerCase()}` : ''
  return `${crypto.randomUUID()}${extension}`
}

export function sanitizeFileName(fileName: string): string {
  return (
    fileName
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|#%]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || `image-${crypto.randomUUID()}.png`
  )
}

export function validateUploadFileName(fileName: string): string | null {
  const value = fileName.trim()
  if (!value) return '文件名不能为空'
  if (value === '.' || value === '..') return '文件名不能使用相对路径'
  if (value.includes('/') || value.includes('\\') || hasControlCharacter(value)) {
    return '文件名不能包含路径分隔符或控制字符'
  }
  if (value.length > 255) return '文件名不能超过 255 个字符'
  const extension = value.split('.').pop()?.toLowerCase()
  if (!extension || !UPLOAD_EXTENSIONS.has(extension)) {
    return '文件扩展名仅支持 PNG、JPG、GIF、WebP、AVIF 或 BMP'
  }
  return null
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
}

export async function compressImageFile(
  file: File,
  options: { quality: number; convertToWebp: boolean; detectedExtension?: string | null },
): Promise<{ file: File; extension: string | null }> {
  const ext = options.detectedExtension ?? (await detectImageExtension(file))
  // Preserve animated GIFs and skip compression for formats not cleanly re-encoded by canvas
  if (!ext || ext === 'gif') {
    return { file, extension: ext }
  }
  const targetMime = options.convertToWebp
    ? 'image/webp'
    : ext === 'jpg'
      ? 'image/jpeg'
      : ext === 'webp'
        ? 'image/webp'
        : null

  if (!targetMime) {
    return { file, extension: ext }
  }

  try {
    const bitmap = await createImageBitmap(file)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return { file, extension: ext }
      ctx.drawImage(bitmap, 0, 0)

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, targetMime, options.quality),
      )
      if (!blob || blob.size === 0) return { file, extension: ext }
      // Only keep compressed result when converting format (and WebP actually produced) or size decreased
      const targetExt = targetMime === 'image/webp' ? 'webp' : 'jpg'
      const producedTarget = blob.type === targetMime
      if (!producedTarget) return { file, extension: ext }
      if (!options.convertToWebp && blob.size >= file.size) {
        return { file, extension: ext }
      }
      if (options.convertToWebp && blob.size >= file.size && ext === 'webp') {
        return { file, extension: ext }
      }
      const nextName = replaceFileExtension(file.name, targetExt)
      return {
        file: new File([blob], nextName, { type: targetMime, lastModified: file.lastModified }),
        extension: targetExt,
      }
    } finally {
      bitmap.close()
    }
  } catch {
    return { file, extension: ext }
  }
}

export async function fileToBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
  const content = dataUrl.split(',')[1]
  if (!content) throw new Error('无法解析图片内容')
  return content
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function escapeMarkdownAlt(value: string): string {
  return value.replace(/([\\\]])/g, '\\$1')
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
