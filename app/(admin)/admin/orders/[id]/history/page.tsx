'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface OrderHistory {
  id: string
  status: string
  comment?: string
  createdAt: string
  user?: { email: string }
}

interface OrderMedia {
  id: string
  fileUrl: string
  type: string
  uploadedAt: string
}

interface OrderSummary {
  id: string
  deliveryAddress: string
  status: string
  paymentProofUrl?: string
  dealer?: { name: string }
  poolModel?: { name: string }
  color?: { name: string }
  factory?: { name: string }

  hardwareSkimmer: boolean
  hardwareReturns: boolean
  hardwareAutocover: boolean
  hardwareMainDrains: boolean
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

const aqua = '#00B2CA'
const deep = '#007A99'

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

export default function OrderHistoryPage() {
  const [summary, setSummary] = useState<OrderSummary | null>(null)
  const [history, setHistory] = useState<OrderHistory[]>([])
  const [mediaFiles, setMediaFiles] = useState<OrderMedia[]>([])
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showModal, setShowModal] = useState(false)

  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  useEffect(() => {
    const fetchSummary = async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, { cache: 'no-store' })
      const data = await safeJson<OrderSummary>(res)
      if (res.ok && data) setSummary(data)
    }

    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/history`, { cache: 'no-store' })
        const data = await safeJson<OrderHistory[] | { items: OrderHistory[] }>(res)
        const list = Array.isArray(data) ? data : Array.isArray((data as any)?.items) ? (data as any).items : []
        setHistory(list)
      } catch (error: any) {
        console.error('Error fetching order history:', error?.message)
        setError('Failed to load order history.')
      }
    }

    const fetchMedia = async () => {
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' })
        const data = await safeJson<OrderMedia[] | { items: OrderMedia[] }>(res)
        const list = Array.isArray(data) ? data : Array.isArray((data as any)?.items) ? (data as any).items : []
        setMediaFiles(list)
      } catch (err) {
        console.error('Error fetching media files:', err)
      }
    }

    fetchSummary()
    fetchHistory()
    fetchMedia()
  }, [orderId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch(`/api/admin/orders/${orderId}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment }),
    })

    const payload = await safeJson<OrderHistory>(res)

    if (res.ok && payload) {
      setHistory((prev) => [payload, ...prev])
      setStatus('')
      setComment('')
      setShowModal(false)
      setMessage('Entry added successfully.')
    } else {
      setMessage(`Failed to add history (${res.status})`)
    }
  }

  const hardwareSelected = useMemo(() => {
    if (!summary) return []
    const items = []
    if (summary.hardwareSkimmer) items.push('Skimmer')
    if (summary.hardwareReturns) items.push('Returns')
    if (summary.hardwareMainDrains) items.push('Main Drains')
    if (summary.hardwareAutocover) items.push('Autocover')
    return items
  }, [summary])

  return (
    <div className="p-4 sm:p-6 relative rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">Order Details & History</h1>
        <div
          className="h-1 w-32 rounded-full"
          style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
        />
      </div>

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {/* Resumen de la orden */}
      {summary && (
        <div className="mb-6 text-sm bg-slate-50 p-4 rounded-lg border">
          <h2 className="font-bold text-slate-800 mb-2">Order Summary</h2>
          <p><b>Dealer:</b> {summary.dealer?.name}</p>
          <p><b>Model:</b> {summary.poolModel?.name}</p>
          <p><b>Color:</b> {summary.color?.name}</p>
          <p><b>Factory:</b> {summary.factory?.name}</p>
          <p><b>Delivery Address:</b> {summary.deliveryAddress}</p>
          {hardwareSelected.length > 0 && (
            <p><b>Hardware Selected:</b> {hardwareSelected.join(', ')}</p>
          )}
        </div>
      )}

      {/* Botones */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Manual Entry
        </button>
        <button
          onClick={() => router.push(`/admin/orders/${orderId}/media`)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Upload Media
        </button>
        <Link
          href="/admin/orders"
          className="px-4 py-2 rounded border bg-white hover:bg-slate-50"
        >
          Back to Orders
        </Link>
      </div>

      {/* Línea de tiempo */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-slate-900 mb-3">Timeline</h3>
        <div className="relative pl-6">
          <div className="absolute left-2 top-0 bottom-0 w-[2px] bg-slate-200" />
          {history.length === 0 ? (
            <div className="text-slate-500">No history found.</div>
          ) : (
            <ul className="space-y-4">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <div className="absolute -left-1 top-1 w-3 h-3 rounded-full bg-white border-2 border-slate-300" />
                  <div className="rounded-lg border bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">
                        {STATUS_LABEL[h.status] ?? h.status}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(h.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm text-slate-700 mt-1">
                      {h.comment?.trim() || <span className="text-slate-400">—</span>}
                    </div>
                    {h.user?.email && (
                      <div className="text-xs text-slate-500 mt-1">
                        by {h.user.email}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Media */}
      <div className="mb-2">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Uploaded Media</h3>
        {mediaFiles.length === 0 ? (
          <p className="text-slate-500">No media uploaded yet.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mediaFiles.map((media) => (
              <li key={media.id} className="border p-3 rounded bg-white shadow-sm">
                <div className="text-xs text-slate-500 mb-1">
                  {new Date(media.uploadedAt).toLocaleString()} • {media.type}
                </div>
                <a
                  href={media.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline text-sm"
                >
                  View File
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Manual Entry</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 font-semibold">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  required
                  className="w-full border px-3 py-2 rounded bg-white"
                >
                  <option value="">Select Status</option>
                  <option value="PENDING_PAYMENT_APPROVAL">Pending Payment Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="IN_PRODUCTION">In Production</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELED">Canceled</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 font-semibold">Comment</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full border px-3 py-2 rounded bg-white"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}