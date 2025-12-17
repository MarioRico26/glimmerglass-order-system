//glimmerglass-order-system/components/admin/AddManualEntry.tsx
'use client'

import { useState } from 'react'

interface Props {
  orderId: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const STATUSES = [
  { value: 'PENDING_PAYMENT_APPROVAL', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'IN_PRODUCTION', label: 'In Production' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Canceled' },
] as const

export default function AddManualEntryModal({ orderId, open, onClose, onSuccess }: Props) {
  const [status, setStatus] = useState<string>('IN_PRODUCTION')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Error creating entry')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
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
          <h3 className="text-xl font-bold text-slate-900">Add Manual Entry</h3>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              required
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-sky-300"
            >
              <option value="" disabled>
                Select Status
              </option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-700">Comment</label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional note…"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

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
              {loading ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}