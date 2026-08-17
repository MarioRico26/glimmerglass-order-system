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

const LEGACY_SHORTCUT_EXTENSIONS = ['.webloc', '.url'] as const

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

export function isLegacyShortcutName(fileName?: string | null) {
  const normalized = String(fileName || '').trim().toLowerCase()
  return LEGACY_SHORTCUT_EXTENSIONS.some((ext) => normalized.endsWith(ext))
}

export function isLegacyShortcutUrl(fileUrl?: string | null) {
  const raw = String(fileUrl || '').trim()
  if (!raw) return false

  try {
    const parsed = new URL(raw)
    return isLegacyShortcutName(parsed.pathname)
  } catch {
    return isLegacyShortcutName(raw.split(/[?#]/)[0] || raw)
  }
}

export async function detectLegacyShortcutUpload(file: File) {
  if (isLegacyShortcutName(file.name)) {
    return 'Web shortcut files (.webloc/.url) are not supported. Upload the actual PDF, image, or video instead.'
  }

  const mime = String(file.type || '').toLowerCase()
  const shouldInspectContent =
    file.size > 0 &&
    file.size <= 512_000 &&
    (!mime ||
      mime === 'application/octet-stream' ||
      mime === 'application/xml' ||
      mime === 'text/xml' ||
      mime === 'text/plain')

  if (!shouldInspectContent) return null

  try {
    const snippet = (await file.text()).slice(0, 4000).toLowerCase()
    const looksLikeMacWebloc =
      snippet.includes('<plist') &&
      snippet.includes('<key>url</key>')
    const looksLikeWindowsShortcut =
      snippet.includes('[internetshortcut]') &&
      snippet.includes('url=')

    if (looksLikeMacWebloc || looksLikeWindowsShortcut) {
      return 'This upload is a web shortcut, not the real document. Please upload the actual PDF, image, or video file.'
    }
  } catch {
    return null
  }

  return null
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
