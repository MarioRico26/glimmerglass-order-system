// glimmerglass-order-system/app/(admin)/admin/orders/[id]/media/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type Media = {
  id: string
  type: string
  docType: string | null
  visibleToDealer?: boolean
  fileUrl: string
  uploadedAt: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  OTHER: 'Other',

  PROOF_OF_PAYMENT: 'Proof of Payment',
  QUOTE: 'Quote',
  INVOICE: 'Invoice',
  PROOF_OF_FINAL_PAYMENT: 'Proof of Final Payment',
  PAID_INVOICE: 'Paid Invoice',
  BILL_OF_LADING: 'Bill of Lading',

  BUILD_SHEET: 'Build Sheet',
  POST_PRODUCTION_MEDIA: 'Post-production Photos/Video',

  SHIPPING_CHECKLIST: 'Shipping Checklist',
  PRE_SHIPPING_MEDIA: 'Pre-shipping Photos/Video',

  WARRANTY: 'Warranty',
  MANUAL: 'Manual',
}

const DOC_GROUPS: Array<{ title: string; items: string[] }> = [
  { title: 'Payment / Finance', items: ['PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE'] },
  {
    title: 'In Production',
    items: ['BUILD_SHEET', 'POST_PRODUCTION_MEDIA'],
  },
  {
    title: 'Pre-shipping',
    items: [
      'SHIPPING_CHECKLIST',
      'PRE_SHIPPING_MEDIA',
      'BILL_OF_LADING',
      'PROOF_OF_FINAL_PAYMENT',
      'PAID_INVOICE',
    ],
  },
  { title: 'Dealer Documents', items: ['WARRANTY', 'MANUAL'] },
  { title: 'Other', items: ['OTHER'] },
]

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

export default function OrderMediaPage() {
  const params = useParams()
  const orderId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined
    return Array.isArray(raw) ? raw[0] : raw ?? ''
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
        setFetchError(`Failed to load files (${res.status})`)
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
      setFetchError('Failed to load files.')
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
    formData.append('docType', docType)
    formData.append('visibleToDealer', String(visibleToDealer))

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, {
        method: 'POST',
        body: formData,
      })
      const payload = await safeJson<any>(res)

      if (res.ok) {
        setMessage('✅ File uploaded.')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await fetchMedia()
      } else {
        setMessage(payload?.message || '❌ Upload failed.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setMessage('❌ Network error during upload.')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-900">Upload Media</h1>
          <p className="text-sm text-slate-500 mt-1">
            Order: <span className="font-mono">{orderId}</span>
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="grid gap-4">
            {/* ✅ Layout stable: 1 col (mobile), 2 cols (md), 4 cols (lg) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-start">
              {/* File */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-1">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>

              {/* Doc Type */}
              <div className="lg:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Document Type
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  {DOC_GROUPS.map((g) => (
                    <optgroup key={g.title} label={g.title}>
                      {g.items.map((k) => (
                        <option key={k} value={k}>
                          {DOC_TYPE_LABELS[k] || k}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Used later for required documents per status.
                </p>
              </div>

              {/* Visibility + Upload (no overlap) */}
              <div className="lg:col-span-1 flex flex-col gap-2">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Visibility
                  </label>
                  <button
                    type="button"
                    onClick={() => setVisibleToDealer((v) => !v)}
                    className={[
                      'w-full rounded-lg border px-3 py-2 text-sm font-semibold',
                      visibleToDealer
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700',
                    ].join(' ')}
                  >
                    {visibleToDealer ? 'Visible to dealer' : 'Internal only'}
                  </button>
                  <p className="text-xs text-slate-500 mt-1">
                    {visibleToDealer ? 'Dealer will see this file.' : 'Hidden from dealer.'}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  {loading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </div>

            {message && (
              <div className="text-sm font-medium text-slate-700">{message}</div>
            )}
          </form>

          <div className="mt-8">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Uploaded Files</h2>

            {fetchError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {fetchError}
              </div>
            ) : mediaList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                No files uploaded yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {mediaList.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {m.docType ? (DOC_TYPE_LABELS[m.docType] || m.docType) : 'Uncategorized'}
                        </span>
                        <span className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
                          {m.visibleToDealer ? 'Dealer' : 'Internal'}
                        </span>
                        <span className="text-xs rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">
                          {m.type}
                        </span>
                      </div>

                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-sky-700 hover:underline mt-1 inline-block truncate max-w-[52ch]"
                      >
                        View / Download
                      </a>
                    </div>

                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(m.uploadedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}