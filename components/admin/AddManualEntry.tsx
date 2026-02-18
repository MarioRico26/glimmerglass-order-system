// glimmerglass-order-system/components/admin/AddManualEntry.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

interface Props {
  orderId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

type RequirementsState = {
  targetStatus: string
  requiredDocs: string[]
  requiredFields: string[]
  missingDocs: string[]
  missingFields: string[]
  satisfiedDocs: string[]
  satisfiedFields: string[]
}

type StatusPatchErrorPayload = {
  code?: string
  message?: string
  required?: { docs?: unknown; fields?: unknown }
  missing?: { docs?: unknown; fields?: unknown }
}

type UploadMediaErrorPayload = {
  message?: string
}

// ✅ APPROVED fuera (ya no lo vamos a usar)
const STATUSES = [
  { value: 'PENDING_PAYMENT_APPROVAL', label: 'Pending Payment Approval' },
  { value: 'IN_PRODUCTION', label: 'In Production' },
  { value: 'PRE_SHIPPING', label: 'Pre-Shipping' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Canceled' },
] as const

const DOC_LABELS: Record<string, string> = {
  PROOF_OF_PAYMENT: 'Proof of Payment',
  QUOTE: 'Quote',
  INVOICE: 'Invoice',

  BUILD_SHEET: 'Build Sheet',
  POST_PRODUCTION_MEDIA: 'Post-production Photos/Video',

  SHIPPING_CHECKLIST: 'Shipping Checklist',
  PRE_SHIPPING_MEDIA: 'Pre-shipping Photos/Video',
  BILL_OF_LADING: 'Bill of Lading',
  PROOF_OF_FINAL_PAYMENT: 'Proof of Final Payment',
  PAID_INVOICE: 'Paid Invoice',
}

function niceDoc(d: string) {
  return DOC_LABELS[d] || d.replaceAll('_', ' ')
}
function niceField(f: string) {
  if (f === 'serialNumber') return 'Serial Number'
  return f.replaceAll('_', ' ')
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    return await res.json()
  } catch {
    return null
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export default function AddManualEntryModal({ orderId, open, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<string>('IN_PRODUCTION')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null)
  const [uploadInfo, setUploadInfo] = useState<string | null>(null)
  const [requirementsLoading, setRequirementsLoading] = useState(false)
  const [dragOverDoc, setDragOverDoc] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<RequirementsState | null>(null)

  const hint = useMemo(() => {
    // Mike rules reminder (sin APPROVED)
    if (status === 'IN_PRODUCTION') {
      return 'To move to In Production: Proof of Payment, Quote, and Invoice.'
    }
    if (status === 'PRE_SHIPPING') {
      return 'To move to Pre-Shipping: Build Sheet, Post-production media, and Serial Number.'
    }
    if (status === 'COMPLETED') {
      return 'To move to Completed: Shipping checklist, Pre-shipping media, Bill of Lading, Proof of Final Payment, Paid invoice, and Serial Number.'
    }
    return null
  }, [status])

  const missingDocs = requirements?.missingDocs ?? []
  const missingFields = requirements?.missingFields ?? []
  const requiredDocs = requirements?.requiredDocs ?? []
  const requiredFields = requirements?.requiredFields ?? []

  const loadRequirements = async (targetStatus: string) => {
    setRequirementsLoading(true)
    try {
      const res = await fetch(
        `/api/admin/orders/${orderId}/status?targetStatus=${encodeURIComponent(targetStatus)}`,
        { cache: 'no-store' }
      )
      const data = await safeJson<{ requirements?: Partial<RequirementsState>; message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || `Failed to load requirements (${res.status})`)

      const payload = data?.requirements
      const requiredDocsNext = asStringArray(payload?.requiredDocs)
      const requiredFieldsNext = asStringArray(payload?.requiredFields)
      const missingDocsNext = asStringArray(payload?.missingDocs)
      const missingFieldsNext = asStringArray(payload?.missingFields)
      const satisfiedDocsNext =
        asStringArray(payload?.satisfiedDocs).length > 0
          ? asStringArray(payload?.satisfiedDocs)
          : requiredDocsNext.filter((d) => !missingDocsNext.includes(d))
      const satisfiedFieldsNext =
        asStringArray(payload?.satisfiedFields).length > 0
          ? asStringArray(payload?.satisfiedFields)
          : requiredFieldsNext.filter((f) => !missingFieldsNext.includes(f))

      setRequirements({
        targetStatus,
        requiredDocs: requiredDocsNext,
        requiredFields: requiredFieldsNext,
        missingDocs: missingDocsNext,
        missingFields: missingFieldsNext,
        satisfiedDocs: satisfiedDocsNext,
        satisfiedFields: satisfiedFieldsNext,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load requirements')
      setRequirements({
        targetStatus,
        requiredDocs: [],
        requiredFields: [],
        missingDocs: [],
        missingFields: [],
        satisfiedDocs: [],
        satisfiedFields: [],
      })
    } finally {
      setRequirementsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    setError(null)
    setUploadInfo(null)
    void loadRequirements(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status, orderId])

  const uploadMissingDoc = async (docType: string, file: File) => {
    setUploadingDoc(docType)
    setUploadInfo(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('docType', docType)
      formData.append('visibleToDealer', 'true')

      const res = await fetch(`/api/admin/orders/${orderId}/media`, {
        method: 'POST',
        body: formData,
        cache: 'no-store',
      })
      const data = await safeJson<UploadMediaErrorPayload>(res)
      if (!res.ok) throw new Error(data?.message || `Upload failed (${res.status})`)

      setRequirements((prev) => {
        if (!prev) return prev
        const nextMissingDocs = prev.missingDocs.filter((d) => d !== docType)
        const nextSatisfiedDocs = prev.satisfiedDocs.includes(docType)
          ? prev.satisfiedDocs
          : [...prev.satisfiedDocs, docType]
        if (nextMissingDocs.length === 0 && prev.missingFields.length === 0) {
          setError(null)
        }
        return {
          ...prev,
          missingDocs: nextMissingDocs,
          satisfiedDocs: nextSatisfiedDocs,
        }
      })
      setUploadInfo(`${niceDoc(docType)} uploaded. Click Save to continue.`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingDoc(null)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    setUploadInfo(null)

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          status,
          comment: comment?.trim() || '',
        }),
      })

      const data = await safeJson<StatusPatchErrorPayload>(res)

      if (!res.ok) {
        if (data?.code === 'MISSING_REQUIREMENTS') {
          const docs = data?.missing?.docs ?? []
          const fields = data?.missing?.fields ?? []
          const requiredDocsFromApi = asStringArray(data?.required?.docs)
          const requiredFieldsFromApi = asStringArray(data?.required?.fields)
          const missingDocsFromApi = asStringArray(docs)
          const missingFieldsFromApi = asStringArray(fields)
          setRequirements({
            targetStatus: status,
            requiredDocs: requiredDocsFromApi,
            requiredFields: requiredFieldsFromApi,
            missingDocs: missingDocsFromApi,
            missingFields: missingFieldsFromApi,
            satisfiedDocs: requiredDocsFromApi.filter((d) => !missingDocsFromApi.includes(d)),
            satisfiedFields: requiredFieldsFromApi.filter((f) => !missingFieldsFromApi.includes(f)),
          })
          setError('Missing required documents/fields to move forward.')
          return
        }
        throw new Error(data?.message || `Failed (${res.status})`)
      }

      setComment('')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating status')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200"
      >
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">Manual Entry</h3>
          <p className="text-sm text-slate-600 mt-1">
            Changes status with Mike’s document/field requirements enforced.
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">New Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {hint ? <div className="text-xs text-slate-500 mt-1">{hint}</div> : null}
            {status === 'IN_PRODUCTION' ? (
              <div className="text-xs text-emerald-700 mt-1">
                Dealer payment proof uploaded at order creation counts automatically.
              </div>
            ) : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Comment (optional)</label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional note…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          {(requirementsLoading || requiredDocs.length > 0 || requiredFields.length > 0) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="text-sm font-semibold text-slate-900 mb-2">Stage Template</div>
              {requirementsLoading ? (
                <div className="text-xs text-slate-500">Loading requirements…</div>
              ) : (
                <div className="space-y-2">
                  {requiredDocs.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Required Documents
                      </div>
                      <div className="space-y-1">
                        {requiredDocs.map((d) => {
                          const missing = missingDocs.includes(d)
                          return (
                            <div
                              key={`req-doc-${d}`}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                            >
                              <span className="font-medium text-slate-800">{niceDoc(d)}</span>
                              <span
                                className={[
                                  'inline-flex rounded-full border px-2 py-0.5 font-semibold',
                                  missing
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-emerald-300 bg-emerald-50 text-emerald-800',
                                ].join(' ')}
                              >
                                {missing ? 'Missing' : 'Ready'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {requiredFields.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                        Required Fields
                      </div>
                      <div className="space-y-1">
                        {requiredFields.map((f) => {
                          const missing = missingFields.includes(f)
                          return (
                            <div
                              key={`req-field-${f}`}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                            >
                              <span className="font-medium text-slate-800">{niceField(f)}</span>
                              <span
                                className={[
                                  'inline-flex rounded-full border px-2 py-0.5 font-semibold',
                                  missing
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-emerald-300 bg-emerald-50 text-emerald-800',
                                ].join(' ')}
                              >
                                {missing ? 'Missing' : 'Ready'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(missingDocs.length > 0 || missingFields.length > 0) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <div className="font-semibold mb-1">Missing requirements:</div>

              {missingDocs.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs font-semibold text-amber-900/80 uppercase tracking-wide">
                    Documents
                  </div>
                  <ul className="list-disc pl-5">
                    {missingDocs.map((d) => (
                      <li key={d}>{niceDoc(d)}</li>
                    ))}
                  </ul>

                  <div className="mt-3 rounded-lg border border-amber-300 bg-white/70 p-2">
                    <div className="text-xs font-semibold text-amber-900/80">
                      Quick upload missing documents
                    </div>
                    <div className="mt-2 space-y-2">
                      {missingDocs.map((d) => (
                        <div
                          key={`upload-${d}`}
                          className={[
                            'flex items-center justify-between gap-2 rounded-md border bg-white px-2 py-1.5',
                            dragOverDoc === d ? 'border-sky-300 ring-2 ring-sky-200' : 'border-amber-200',
                          ].join(' ')}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverDoc(d)
                          }}
                          onDragLeave={() => setDragOverDoc((prev) => (prev === d ? null : prev))}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragOverDoc(null)
                            const file = e.dataTransfer.files?.[0]
                            if (file) void uploadMissingDoc(d, file)
                          }}
                        >
                          <div className="text-xs font-medium text-amber-900">
                            {niceDoc(d)} (drag & drop or upload)
                          </div>
                          <label
                            className={[
                              'inline-flex h-8 cursor-pointer items-center rounded-md border px-2 text-xs font-semibold',
                              uploadingDoc === d
                                ? 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                                : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100',
                            ].join(' ')}
                          >
                            {uploadingDoc === d ? 'Uploading…' : 'Upload'}
                            <input
                              type="file"
                              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                              className="hidden"
                              disabled={uploadingDoc === d}
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0]
                                if (file) void uploadMissingDoc(d, file)
                                setDragOverDoc(null)
                                e.currentTarget.value = ''
                              }}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {missingFields.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-amber-900/80 uppercase tracking-wide">
                    Fields
                  </div>
                  <ul className="list-disc pl-5">
                    {missingFields.map((f) => (
                      <li key={f}>{niceField(f)}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-amber-900/70 mt-2">
                Upload missing files here (or in “Upload Media”), fill required fields, then click Save again.
              </div>
            </div>
          )}

          {uploadInfo && (
            <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-sm">
              {uploadInfo}
            </div>
          )}

          {error && (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-xl bg-blue-600 px-5 font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
