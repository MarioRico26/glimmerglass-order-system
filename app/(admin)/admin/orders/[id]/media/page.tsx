// app/(admin)/admin/orders/[id]/media/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type Media = {
  id: string
  type: string
  fileUrl: string
  uploadedAt: string
  docType?: string | null
  visibleToDealer?: boolean
}

const DOC_TYPES: { value: string; label: string; group: string }[] = [
  { value: 'PROOF_OF_PAYMENT', label: 'Proof of Payment', group: 'Pending Payment Approval' },
  { value: 'QUOTE', label: 'Quote', group: 'Pending Payment Approval' },
  { value: 'INVOICE', label: 'Invoice', group: 'Pending Payment Approval' },

  { value: 'BUILD_SHEET', label: 'Build Sheet', group: 'In Production' },
  { value: 'POST_PRODUCTION_MEDIA', label: 'Post-production Photos/Video', group: 'In Production' },

  { value: 'SHIPPING_CHECKLIST', label: 'Shipping Checklist', group: 'Pre-shipping' },
  { value: 'PRE_SHIPPING_MEDIA', label: 'Pre-shipping Photos/Video', group: 'Pre-shipping' },
  { value: 'BILL_OF_LADING', label: 'Bill of Lading', group: 'Pre-shipping' },
  { value: 'PROOF_OF_FINAL_PAYMENT', label: 'Proof of Final Payment', group: 'Pre-shipping' },
  { value: 'PAID_INVOICE', label: 'Paid Invoice', group: 'Pre-shipping' },

  // Extra “dealer library” stuff (manuals, warranties, etc.)
  { value: 'WARRANTY', label: 'Warranty', group: 'Dealer Documents' },
  { value: 'MANUAL', label: 'Manual', group: 'Dealer Documents' },
  { value: 'OTHER', label: 'Other', group: 'Dealer Documents' },
]

function groupDocTypes() {
  const groups: Record<string, { value: string; label: string }[]> = {}
  for (const d of DOC_TYPES) {
    groups[d.group] ||= []
    groups[d.group].push({ value: d.value, label: d.label })
  }
  return groups
}

function toApiUrl(fileUrl: string) {
  return fileUrl?.startsWith('/uploads/')
    ? '/api/uploads/' + fileUrl.replace('/uploads/', '')
    : fileUrl
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export default function OrderMediaPage() {
  const params = useParams()
  const orderId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined
    return Array.isArray(raw) ? raw[0] : (raw ?? '')
  }, [params])

  const [file, setFile] = useState<File | null>(null)

  // legacy media “type” (optional)
  const [type, setType] = useState<'update' | 'proof' | 'photo' | 'note'>('update')

  // NEW
  const [docType, setDocType] = useState<string>('OTHER')
  const [visibleToDealer, setVisibleToDealer] = useState<boolean>(true)

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const docGroups = useMemo(() => groupDocTypes(), [])

  const fetchMedia = async () => {
    if (!orderId) return
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' })
      if (!res.ok) {
        setFetchError(`Failed: ${res.status}`)
        setMediaList([])
        return
      }
      const data = await safeJson<Media[] | { items: Media[] }>(res)
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
          ? (data as any).items
          : []
      setMediaList(items)
    } catch (err) {
      console.error('Error fetching media:', err)
      setFetchError('Failed to load media.')
    }
  }

  useEffect(() => {
    fetchMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!orderId) return setMessage('Missing order id.')
    if (!file) return setMessage('Please select a file.')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    formData.append('docType', docType)
    formData.append('visibleToDealer', visibleToDealer ? 'true' : 'false')

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, {
        method: 'POST',
        body: formData,
      })
      const payload = await safeJson<any>(res)

      if (res.ok) {
        setMessage('✅ File uploaded!')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchMedia()
      } else {
        setMessage(payload?.message || 'Upload failed.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setMessage('Network error during upload.')
    } finally {
      setLoading(false)
    }
  }

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url)
  const isPdf = (url: string) => /\.pdf$/i.test(url)

  const badge = (text: string, kind: 'good' | 'neutral' | 'warn') => {
    const cls =
      kind === 'good'
        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
        : kind === 'warn'
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-slate-50 text-slate-700 border-slate-200'
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${cls}`}>
        {text}
      </span>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">Upload Media</h1>
        <div className="text-xs text-slate-400">
          Order: <span className="font-mono">{orderId}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-semibold text-slate-800">File</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full border border-slate-300 rounded-lg p-2 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-sm font-semibold text-slate-800">Media Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white"
              >
                <option value="update">Update</option>
                <option value="proof">Proof</option>
                <option value="photo">Photo</option>
                <option value="note">Note</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">Optional categorization.</p>
            </div>

            <div>
              <label className="block mb-1 text-sm font-semibold text-slate-800">Dealer can view</label>
              <button
                type="button"
                onClick={() => setVisibleToDealer((v) => !v)}
                className={[
                  'w-full rounded-lg border px-3 py-2 text-sm font-semibold',
                  visibleToDealer
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700',
                ].join(' ')}
              >
                {visibleToDealer ? 'Visible to dealer' : 'Admin only'}
              </button>
              <p className="mt-1 text-xs text-slate-500">Hide internal docs from dealers.</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-semibold text-slate-800">Doc Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white"
            >
              {Object.entries(docGroups).map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((it) => (
                    <option key={it.value} value={it.value}>
                      {it.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              This is what we’ll use later for “required documents per status”.
            </p>
          </div>

          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-sky-700 text-white px-4 py-2 rounded-lg hover:bg-sky-800 disabled:opacity-50"
            >
              {loading ? 'Uploading…' : 'Upload'}
            </button>
            {message && <p className="text-sm text-slate-700">{message}</p>}
          </div>
        </div>
      </form>

      <h2 className="text-lg font-bold mb-2 text-slate-900">Uploaded Files</h2>
      {fetchError ? (
        <p className="text-red-600">{fetchError}</p>
      ) : mediaList.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl py-10 text-center text-sm text-slate-500">
          No media uploaded yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaList.map((m) => {
            const url = toApiUrl(m.fileUrl)
            return (
              <div key={m.id} className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {badge(m.type, 'neutral')}
                  {badge(m.docType || 'NO_DOC_TYPE', m.docType ? 'neutral' : 'warn')}
                  {badge(m.visibleToDealer ? 'Visible to dealer' : 'Admin only', m.visibleToDealer ? 'good' : 'warn')}
                </div>

                <div className="text-xs text-slate-500 mb-2">
                  {new Date(m.uploadedAt).toLocaleString()}
                </div>

                <div className="aspect-video bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                  {isImage(url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="media" className="object-cover w-full h-full" />
                  ) : isPdf(url) ? (
                    <div className="text-slate-500 text-sm">PDF Document</div>
                  ) : (
                    <div className="text-slate-500 text-sm">File</div>
                  )}
                </div>

                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sky-700 hover:underline text-sm font-semibold"
                >
                  View / Download
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}