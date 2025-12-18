// glimmerglass-order-system/components/admin/AddManualEntry.tsx
'use client'

import { useMemo, useState } from 'react'

interface Props {
  orderId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
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

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    return await res.json()
  } catch {
    return null
  }
}

export default function AddManualEntryModal({ orderId, open, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<string>('IN_PRODUCTION')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [missingFields, setMissingFields] = useState<string[]>([])

  const hint = useMemo(() => {
    // Mike rules reminder (sin APPROVED)
    if (status === 'IN_PRODUCTION') {
      return 'To move to In Production: Proof of Payment, Quote, Invoice + Serial Number (if required by your flow).'
    }
    if (status === 'PRE_SHIPPING') {
      return 'To move to Pre-Shipping: Build Sheet, Post-production media, and Serial Number.'
    }
    if (status === 'COMPLETED') {
      return 'To move to Completed: Shipping checklist, Pre-shipping media, Bill of Lading, Proof of Final Payment, Paid invoice, and Serial Number.'
    }
    return null
  }, [status])

  if (!open) return null

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    setMissingDocs([])
    setMissingFields([])

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

      const data = await safeJson(res)

      if (!res.ok) {
        if (data?.code === 'MISSING_REQUIREMENTS') {
          const docs = data?.missing?.docs ?? []
          const fields = data?.missing?.fields ?? []
          setMissingDocs(Array.isArray(docs) ? docs : [])
          setMissingFields(Array.isArray(fields) ? fields : [])
          setError('Missing required documents/fields to move forward.')
          return
        }
        throw new Error(data?.message || `Failed (${res.status})`)
      }

      setComment('')
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Error updating status')
    } finally {
      setLoading(false)
    }
  }

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
                Upload the missing files in “Upload Media” and fill required fields (like Serial Number) in the Order Summary.
              </div>
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