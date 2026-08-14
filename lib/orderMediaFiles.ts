const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
  'video/avi': '.avi',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-msvideo': '.avi',
}

const KNOWN_FILE_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.heic',
  '.heif',
  '.mp4',
  '.mov',
  '.m4v',
  '.webm',
  '.avi',
] as const

function sanitizeBaseName(value: string) {
  const cleaned = value
    .replace(/^\d{12,}-/, '')
    .replace(/[?#].*$/, '')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-.]+|[_\-.]+$/g, '')

  return cleaned || 'file'
}

function stripKnownExtensions(value: string) {
  let current = value

  while (KNOWN_FILE_EXTENSIONS.some((ext) => current.toLowerCase().endsWith(ext))) {
    const matched = KNOWN_FILE_EXTENSIONS.find((ext) => current.toLowerCase().endsWith(ext))
    if (!matched) break
    current = current.slice(0, -matched.length)
  }

  return current || value
}

export function extensionFromContentType(contentType?: string | null) {
  const normalized = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()

  return MIME_EXTENSION_MAP[normalized] || ''
}

export function normalizeStoredUploadName(fileName: string, contentType?: string | null) {
  const rawName = String(fileName || 'upload').trim() || 'upload'
  const withoutQuery = rawName.replace(/[?#].*$/, '')
  const base = sanitizeBaseName(stripKnownExtensions(withoutQuery))
  const ext = extensionFromContentType(contentType) || (() => {
    const match = withoutQuery.match(/(\.[a-z0-9]+)$/i)
    return match ? match[1].toLowerCase() : ''
  })()

  return `${base}${ext || ''}`
}

export function buildOrderMediaBlobKey(orderId: string, fileName: string, contentType?: string | null) {
  const normalizedName = normalizeStoredUploadName(fileName, contentType)
  return `orders/${orderId}/${Date.now()}-${normalizedName}`
}

export function buildOrderMediaDownloadName(fileUrl: string, fallbackName: string, contentType?: string | null) {
  const parsedUrl = (() => {
    try {
      return new URL(fileUrl)
    } catch {
      return null
    }
  })()

  const sourceName =
    parsedUrl?.pathname.split('/').filter(Boolean).pop() ||
    fallbackName ||
    'file'

  return normalizeStoredUploadName(sourceName, contentType)
}
