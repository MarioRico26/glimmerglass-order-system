//glimmerglass-order-system/app/(admin)/admin/orders/[id]/media/page.tsx:
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type Media = {
  id: string
  type: string
  fileUrl: string
  uploadedAt: string
  docType?: string | null
  visibleToDealer: boolean
}

type DocGroup = { label: string; options: { value: string; label: string }[] }

const DOC_GROUPS: DocGroup[] = [
  {
    label: 'Pending Payment Approval',
    options: [
      { value: 'PROOF_OF_PAYMENT', label: 'Proof of Payment' },
      { value: 'QUOTE', label: 'Quote' },
      { value: 'INVOICE', label: 'Invoice' },
    ],
  },
  {
    label: 'In Production',
    options: [
      { value: 'BUILD_SHEET', label: 'Build Sheet' },
      { value: 'POST_PRODUCTION_MEDIA', label: 'Post-production Photos/Video' },
    ],
  },
  {
    label: 'Pre-shipping',
    options: [
      { value: 'SHIPPING_CHECKLIST', label: 'Shipping Checklist' },
      { value: 'PRE_SHIPPING_MEDIA', label: 'Pre-shipping Photos/Video' },
      { value: 'BILL_OF_LADING', label: 'Bill of Lading' },
      { value: 'PROOF_OF_FINAL_PAYMENT', label: 'Proof of Final Payment' },
      { value: 'PAID_INVOICE', label: 'Paid Invoice' },
    ],
  },
  {
    label: 'Dealer Documents',
    options: [
      // No tienes estos en el enum; si los quieres, agrégalos al enum (WARRANTY, MANUAL).
      // Por ahora usa “Other” y visibleToDealer = true para warranty/manual.
      // { value: 'WARRANTY', label: 'Warranty' },
      // { value: 'MANUAL', label: 'Manual' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
]

const ALL_DOC_VALUES = new Set(
  DOC_GROUPS.flatMap(g => g.options.map(o => o.value)).filter(v => v !== 'OTHER')
)

function toApiUrl(fileUrl: string) {
  return fileUrl?.startsWith('/uploads/')
    ? '/api/uploads/' + fileUrl.replace('/uploads/', '')
    : fileUrl
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

function isImage(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url)
}
function isPdf(url: string) {
  return /\.pdf$/i.test(url)
}

export default function OrderMediaPage() {
  const params = useParams()
  const orderId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined
    return Array.isArray(raw) ? raw[0] : (raw ?? '')
  }, [params])

  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<string>('OTHER')
  const [visibleToDealer, setVisibleToDealer] = useState(true)

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [mediaList, setMediaList] = useState<Media[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

    // docType: si no está en enum real, mandamos null (OTHER = null)
    if (docType && docType !== 'OTHER') formData.append('docType', docType)

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
        await fetchMedia()
      } else {
        setMessage(payload?.message || `Upload failed (${res.status}).`)
      }
    } catch (err) {
      console.error('Upload error:', err)
      setMessage('Network error during upload.')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">Upload Media</h1>
            <p className="text-xs text-slate-500 mt-1">
              Order: <span className="font-mono">{orderId}</span>
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-12 items-end">
            <div className="lg:col-span-5">
              <label className="block mb-1 text-sm font-semibold text-slate-700">File</label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block mb-1 text-sm font-semibold text-slate-700">Doc Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
              >
                {DOC_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {/* siempre deja OTHER como fallback */}
                {!ALL_DOC_VALUES.has('OTHER') && <option value="OTHER">Other</option>}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Esto es lo que vas a usar luego para “required documents per status”.
              </p>
            </div>

            <div className="lg:col-span-2">
              <label className="block mb-1 text-sm font-semibold text-slate-700">Dealer can view</label>
              <button
                type="button"
                onClick={() => setVisibleToDealer(v => !v)}
                className={[
                  'w-full rounded-lg px-3 py-2 text-sm font-semibold border transition',
                  visibleToDealer
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-50 border-slate-200 text-slate-700',
                ].join(' ')}
              >
                {visibleToDealer ? 'Visible to dealer' : 'Internal only'}
              </button>
              <p className="text-xs text-slate-500 mt-1">
                {visibleToDealer ? 'Dealer lo verá.' : 'Oculto para dealers.'}
              </p>
            </div>

            <div className="lg:col-span-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-sky-700 text-white text-sm font-semibold px-4 py-2 hover:bg-sky-800 disabled:bg-sky-300"
              >
                {loading ? 'Uploading…' : 'Upload'}
              </button>
            </div>

            {message && (
              <div className="lg:col-span-12">
                <div className="text-sm font-semibold text-slate-700">{message}</div>
              </div>
            )}
          </form>

          <div className="mt-8">
            <h2 className="text-lg font-black text-slate-900 mb-3">Uploaded Files</h2>

            {fetchError ? (
              <div className="text-sm text-red-600">{fetchError}</div>
            ) : mediaList.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl py-10 text-center text-sm text-slate-500">
                No media uploaded yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mediaList.map((m) => {
                  const url = toApiUrl(m.fileUrl)
                  return (
                    <div key={m.id} className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-xs text-slate-500">
                          {new Date(m.uploadedAt).toLocaleString()}
                        </div>
                        <div className="flex gap-1">
                          {m.docType && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                              {m.docType.replaceAll('_', ' ')}
                            </span>
                          )}
                          <span
                            className={[
                              'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                              m.visibleToDealer
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-slate-50 text-slate-700',
                            ].join(' ')}
                          >
                            {m.visibleToDealer ? 'Dealer' : 'Internal'}
                          </span>
                        </div>
                      </div>

                      <div className="aspect-video bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {isImage(url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="media" className="object-cover w-full h-full" />
                        ) : isPdf(url) ? (
                          <div className="text-slate-500 text-sm font-semibold">PDF</div>
                        ) : (
                          <div className="text-slate-500 text-sm font-semibold">File</div>
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
        </div>
      </div>
    </div>
  )
}