const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'ico', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

export function validateImage(file: File): string | null {
  if (!file.type.startsWith('image/')) return '仅支持图片文件'
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return '出于安全考虑，不支持上传 SVG'
  }
  if (file.size > MAX_IMAGE_SIZE) return '图片不能超过 10 MB'
  if (file.size === 0) return '图片内容为空'
  return null
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
  return null
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
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
