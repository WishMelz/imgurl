import { describe, expect, it } from 'vitest'
import {
  deduplicateFileName,
  detectImageExtension,
  ensureImageExtension,
  escapeHtmlAttribute,
  escapeMarkdownAlt,
  formatBytes,
  isImageContent,
  replaceFileExtension,
  sanitizeFileName,
  validateImage,
  validateUploadFileName,
} from '@/lib/files'

function makeFile(bytes: number[], name: string, type = ''): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

describe('lib/files', () => {
  it('validates image files and rejects SVG / empty / oversized / non-image', () => {
    expect(validateImage(makeFile([1, 2, 3], 'a.png', 'image/png'))).toBeNull()
    expect(validateImage(makeFile([1, 2, 3], 'a.avif', ''))).toBeNull()
    expect(validateImage(makeFile([1, 2, 3], 'x.svg', 'image/svg+xml'))).toContain('SVG')
    expect(validateImage(makeFile([1, 2, 3], 'x.svg', ''))).toContain('SVG')
    expect(validateImage(makeFile([1, 2, 3], 'doc.txt', 'text/plain'))).toBe('仅支持图片文件')
    expect(validateImage(makeFile([], 'empty.png', 'image/png'))).toBe('图片内容为空')
  })

  it('detects magic bytes including mif1-compatible AVIF', async () => {
    const png = makeFile([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a.bin')
    const jpg = makeFile([0xff, 0xd8, 0xff, 0xe0], 'b.bin')
    const gif = makeFile(
      [...'GIF89a'].map((c) => c.charCodeAt(0)),
      'c.bin',
    )
    const webp = makeFile(
      [...'RIFF0000WEBP'].map((c) => c.charCodeAt(0)),
      'd.bin',
    )
    const bmp = makeFile([0x42, 0x4d, 0x00, 0x00], 'e.bin')
    const avifDirect = makeFile(
      [0, 0, 0, 20, ...'ftypavif'].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c)),
      'f.bin',
    )
    const avifCompat = makeFile(
      [0, 0, 0, 28, ...'ftypmif1', 0, 0, 0, 0, ...'mif1avif'].map((c) =>
        typeof c === 'string' ? c.charCodeAt(0) : c,
      ),
      'g.bin',
    )
    const unknown = makeFile([1, 2, 3, 4], 'h.bin')

    expect(await detectImageExtension(png)).toBe('png')
    expect(await detectImageExtension(jpg)).toBe('jpg')
    expect(await detectImageExtension(gif)).toBe('gif')
    expect(await detectImageExtension(webp)).toBe('webp')
    expect(await detectImageExtension(bmp)).toBe('bmp')
    expect(await detectImageExtension(avifDirect)).toBe('avif')
    expect(await detectImageExtension(avifCompat)).toBe('avif')
    expect(await detectImageExtension(unknown)).toBeNull()
  })

  it('deduplicates colliding file names case-insensitively', () => {
    const existing = new Set(['image.png', 'image-2.png'])
    expect(deduplicateFileName('photo.png', existing)).toBe('photo.png')
    expect(deduplicateFileName('IMAGE.png', existing)).toBe('IMAGE-3.png')
  })

  it('normalizes extensions and sanitizes names safely', () => {
    expect(ensureImageExtension('clip', 'png')).toBe('clip.png')
    expect(ensureImageExtension('clip.jpg', 'png')).toBe('clip.jpg')
    expect(replaceFileExtension('photo.png', 'webp')).toBe('photo.webp')
    expect(sanitizeFileName('my photo/2026#1?.png')).toBe('my-photo-2026-1-.png')
    expect(isImageContent('avatar.WEBP')).toBe(true)
    expect(isImageContent('README.md')).toBe(false)
  })

  it('validates upload filenames and escapes output strings', () => {
    expect(validateUploadFileName('ok.png')).toBeNull()
    expect(validateUploadFileName('')).toBeTruthy()
    expect(validateUploadFileName('../a.png')).toBeTruthy()
    expect(validateUploadFileName('script.svg')).toBeTruthy()
    expect(escapeMarkdownAlt('a]b\\c')).toBe('a\\]b\\\\c')
    expect(escapeHtmlAttribute('a"b<c>&')).toBe('a&quot;b&lt;c&gt;&amp;')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })
})
