// glimmerglass-order-system/app/(admin)/admin/orders/[id]/media/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useWorkflowDocLabels } from '@/hooks/useWorkflowDocLabels'
import { labelDocType } from '@/lib/orderFlow'

type Media = {
  id: string
  type: string
  docType: string | null
  visibleToDealer?: boolean
  fileUrl: string
  uploadedAt: string
  uploadedByRole?: string | null
  uploadedByDisplayName?: string | null
  uploadedByEmail?: string | null
}

type WorkflowDocumentOption = {
  id: string
  key: string
  label: string
  sortOrder: number
  source: 'legacy' | 'custom'
  legacyDocType?: string | null
  active: boolean
  visibleToDealerDefault: boolean
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

function formatUploader(media: Pick<Media, 'uploadedByDisplayName' | 'uploadedByEmail'>) {
  const displayName = media.uploadedByDisplayName?.trim()
  const email = media.uploadedByEmail?.trim()
  if (displayName && email) return `${displayName} • ${email}`
  if (displayName) return displayName
  if (email) return email
  return 'Legacy upload'
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
  const [docOptions, setDocOptions] = useState<WorkflowDocumentOption[]>([])

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { labelForDocType } = useWorkflowDocLabels()
  const selectedDoc = useMemo(
    () => docOptions.find((item) => item.key === docType) || null,
    [docOptions, docType]
  )
  const legacyDocOptions = useMemo(
    () => docOptions.filter((item) => item.source === 'legacy'),
    [docOptions]
  )
  const customDocOptions = useMemo(
    () => docOptions.filter((item) => item.source === 'custom'),
    [docOptions]
  )
  const customDocKeys = useMemo(
    () => new Set(customDocOptions.map((item) => item.key)),
    [customDocOptions]
  )

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

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/workflow-doc-labels', { cache: 'no-store' })
        const data = await safeJson<{ items?: WorkflowDocumentOption[] }>(res)
        if (!res.ok || !Array.isArray(data?.items)) return
        setDocOptions(data.items)
        const selected = data.items.find((item) => item.key === docType)
        if (selected) {
          setVisibleToDealer(selected.visibleToDealerDefault)
        } else if (data.items.length > 0) {
          setDocType(data.items[0].key)
          setVisibleToDealer(data.items[0].visibleToDealerDefault)
        }
      } catch {
        // keep defaults
      }
    })()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!orderId) return setMessage('Missing order id.')
    if (!file) return setMessage('Please select a file.')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentKey', docType)
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
    <div className="w-full p-6 xl:p-8">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-2xl font-black text-slate-900">Upload Media</h1>
          <p className="text-sm text-slate-500 mt-1">
            Order: <span className="font-mono">{orderId}</span>
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr] items-start">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-start">
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

                <div className="lg:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Document Type
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => {
                      const nextKey = e.target.value
                      setDocType(nextKey)
                      const nextOption = docOptions.find((item) => item.key === nextKey)
                      if (nextOption) setVisibleToDealer(nextOption.visibleToDealerDefault)
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {legacyDocOptions.length ? (
                      <optgroup label="Core Workflow Documents">
                        {legacyDocOptions.map((item) => (
                          <option key={item.id} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {customDocOptions.length ? (
                      <optgroup label="Custom Documents">
                        {customDocOptions.map((item) => (
                          <option key={item.id} value={item.key}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Used later for required documents per status.
                  </p>
                </div>

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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Selected Document
                </div>
                {selectedDoc ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-base font-black text-slate-900">{selectedDoc.label}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <span
                          className={[
                            'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                            selectedDoc.source === 'custom'
                              ? 'border-violet-200 bg-violet-50 text-violet-800'
                              : 'border-sky-200 bg-sky-50 text-sky-800',
                          ].join(' ')}
                        >
                          {selectedDoc.source === 'custom' ? 'Custom document' : 'Core workflow document'}
                        </span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          Default: {selectedDoc.visibleToDealerDefault ? 'Dealer visible' : 'Internal only'}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                      <div>
                        Internal key: <span className="font-semibold text-slate-900">{selectedDoc.key}</span>
                      </div>
                      {selectedDoc.legacyDocType ? (
                        <div className="mt-1">
                          Legacy type: <span className="font-semibold text-slate-900">{selectedDoc.legacyDocType}</span>
                        </div>
                      ) : null}
                    </div>

                    <p className="text-xs text-slate-500">
                      This selection controls workflow validation and file labeling. Custom documents behave like first-class workflow documents.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-600">
                    Select a document type to review its behavior before upload.
                  </div>
                )}
              </div>
            </div>

            {message && <div className="text-sm font-medium text-slate-700">{message}</div>}
          </form>

          <div className="mt-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-900">Uploaded Files</h2>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {mediaList.length} total
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                  {legacyDocOptions.length} core docs
                </span>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                  {customDocOptions.length} custom docs
                </span>
              </div>
            </div>

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
                          {m.docType
                            ? labelForDocType(m.docType) || labelDocType(m.docType) || m.docType
                            : 'Uncategorized'}
                        </span>
                        <span
                          className={[
                            'text-xs rounded-full border px-2 py-0.5',
                            customDocKeys.has(m.docType || '')
                              ? 'border-violet-200 bg-violet-50 text-violet-700'
                              : 'border-sky-200 bg-sky-50 text-sky-700',
                          ].join(' ')}
                        >
                          {customDocKeys.has(m.docType || '') ? 'Custom' : 'Core'}
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

                      <div className="text-xs text-slate-500 mt-1">
                        Uploaded by: {formatUploader(m)}
                      </div>
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
