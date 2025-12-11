//glimmerglass-order-system/app/(admin)/admin/orders/[id]/history/page.tsx:
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

  dealer?: {
    id: string
    name: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
  }

  poolModel?: { name: string }
  color?: { name: string }

  factory?: {
    id: string
    name: string
    city?: string
    state?: string
  }

  shippingMethod?: string | null
  requestedShipDate?: string | null
  serialNumber?: string | null
  productionPriority?: number | null

  hardwareSkimmer: boolean
  hardwareReturns: boolean
  hardwareAutocover: boolean
  hardwareMainDrains: boolean
}

interface FactoryLocation {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

const SHIPPING_LABELS: Record<string, string> = {
  PICK_UP: 'Pick Up',
  QUOTE: 'Shipping Quote',
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

export default function OrderHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [summary, setSummary] = useState<OrderSummary | null>(null)
  const [history, setHistory] = useState<OrderHistory[]>([])
  const [mediaFiles, setMediaFiles] = useState<OrderMedia[]>([])
  const [factoryList, setFactoryList] = useState<FactoryLocation[]>([])
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)

        const [orderRes, historyRes, mediaRes, factoriesRes] = await Promise.all([
          fetch(`/api/admin/orders/${orderId}/status`, { cache: 'no-store' }),
          fetch(`/api/admin/orders/${orderId}/history`, { cache: 'no-store' }),
          fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' }),
          fetch('/api/factories', { cache: 'no-store' }),
        ])

        const orderData = await safeJson<OrderSummary>(orderRes)
        const historyData = await safeJson<OrderHistory[] | { items: OrderHistory[] }>(historyRes)
        const mediaData = await safeJson<OrderMedia[] | { items: OrderMedia[] }>(mediaRes)
        const factoriesData = await safeJson<FactoryLocation[]>(factoriesRes)

        if (orderData) {
          setSummary(orderData)
          setSelectedFactoryId(orderData.factory?.id || '')
          setSelectedShippingMethod(orderData.shippingMethod || '')
        } else {
          setMessage('❌ Failed to load order data.')
        }

        if (Array.isArray(historyData)) {
          setHistory(historyData)
        } else if (historyData && Array.isArray((historyData as any).items)) {
          setHistory((historyData as any).items)
        }

        if (Array.isArray(mediaData)) {
          setMediaFiles(mediaData)
        } else if (mediaData && Array.isArray((mediaData as any).items)) {
          setMediaFiles((mediaData as any).items)
        }

        if (Array.isArray(factoriesData)) {
          setFactoryList(factoriesData)
        }
      } catch (error) {
        console.error('Error fetching order details:', error)
        setMessage('❌ Error loading order data.')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [orderId])

  const hardwareSelected = useMemo(() => {
    if (!summary) return []
    const parts: string[] = []
    if (summary.hardwareSkimmer) parts.push('Skimmer')
    if (summary.hardwareReturns) parts.push('Returns')
    if (summary.hardwareMainDrains) parts.push('Main Drains')
    if (summary.hardwareAutocover) parts.push('Autocover')
    return parts
  }, [summary])

  const handleSaveChanges = async () => {
    try {
      setSaving(true)
      setMessage('🔄 Saving changes...')

      const res = await fetch(`/api/admin/orders/${orderId}/factory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factoryLocationId: selectedFactoryId || null,
          shippingMethod: selectedShippingMethod || null,
        }),
      })

      if (!res.ok) {
        setMessage('❌ Error saving changes.')
        return
      }

      const updated = await safeJson<OrderSummary>(res)
      if (updated) {
        setSummary(updated)
        setSelectedFactoryId(updated.factory?.id || '')
        setSelectedShippingMethod(updated.shippingMethod || '')
      }

      setEditing(false)
      setMessage('✅ Changes saved successfully.')

      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      console.error('Save error:', error)
      setMessage('❌ Network error while saving.')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitHistory = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setMessage('🔄 Adding history entry...')

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
        setMessage('✅ History entry added.')
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(`❌ Failed to add history entry (${res.status}).`)
      }
    } catch (error) {
      console.error('History error:', error)
      setMessage('❌ Network error while adding history.')
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-center items-center h-64 text-gray-600">
          Loading order data…
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">
            Order Details & History
          </h1>
          {summary && (
            <p className="text-slate-600 text-sm mt-1">Order ID: {summary.id}</p>
          )}
        </div>
        <Link
          href="/admin/orders"
          className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-medium"
        >
          Back to Orders
        </Link>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            message.startsWith('✅')
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : message.startsWith('🔄')
              ? 'bg-blue-50 border border-blue-200 text-blue-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {message}
        </div>
      )}

      {/* Summary card */}
      {summary && (
        <div className="rounded-2xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] p-6 space-y-6">
          {/* 3-column summary */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Order info */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Order
              </h2>
              <p className="text-sm">
                <span className="font-semibold text-slate-800">Model:</span>{' '}
                {summary.poolModel?.name || 'N/A'}
              </p>
              <p className="text-sm">
                <span className="font-semibold text-slate-800">Color:</span>{' '}
                {summary.color?.name || 'N/A'}
              </p>
              <p className="mt-2 text-sm flex items-center gap-2">
                <span className="font-semibold text-slate-800">Status:</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                  {STATUS_LABEL[summary.status] || summary.status.replace(/_/g, ' ')}
                </span>
              </p>
            </div>

            {/* Dealer info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
  {/* Dealer info */}
  <div className="space-y-2">
    <p>
      <strong className="block text-sm text-gray-600">Dealer</strong>
      <span className="text-gray-900">{summary.dealer?.name ?? 'N/A'}</span>
    </p>

    {summary.dealer?.email && (
      <p className="text-sm text-gray-700">
        <strong className="text-gray-600">Email: </strong>
        <a
          href={`mailto:${summary.dealer.email}`}
          className="text-cyan-700 hover:underline"
        >
          {summary.dealer.email}
        </a>
      </p>
    )}

    {summary.dealer?.phone && (
      <p className="text-sm text-gray-700">
        <strong className="text-gray-600">Phone: </strong>
        <a
          href={`tel:${summary.dealer.phone}`}
          className="text-cyan-700 hover:underline"
        >
          {summary.dealer.phone}
        </a>
      </p>
    )}

    {(summary.dealer?.address || summary.dealer?.city || summary.dealer?.state) && (
      <p className="text-sm text-gray-700">
        <strong className="block text-gray-600">Dealer Address</strong>
        <span className="text-gray-900">
          {summary.dealer?.address && <>{summary.dealer.address}<br /></>}
          {(summary.dealer?.city || summary.dealer?.state) && (
            <>
              {summary.dealer?.city}
              {summary.dealer?.city && summary.dealer?.state ? ', ' : ''}
              {summary.dealer?.state}
            </>
          )}
        </span>
      </p>
    )}
  </div>

  {/* Order meta */}
  <div className="space-y-2">
    <p>
      <strong className="block text-sm text-gray-600">Pool Model</strong>
      <span className="text-gray-900">{summary.poolModel?.name ?? 'N/A'}</span>
    </p>
    <p>
      <strong className="block text-sm text-gray-600">Color</strong>
      <span className="text-gray-900">{summary.color?.name ?? 'N/A'}</span>
    </p>
    <p>
      <strong className="block text-sm text-gray-600">Status</strong>
      <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-xs font-semibold text-blue-800">
        {STATUS_LABEL[summary.status] ?? summary.status}
      </span>
    </p>
    <p>
      <strong className="block text-sm text-gray-600">Requested Ship Date</strong>
      <span className="text-gray-900">
        {summary.requestedShipDate
          ? new Date(summary.requestedShipDate).toLocaleDateString()
          : <em className="text-gray-500">Not set</em>}
      </span>
    </p>
    <p>
      <strong className="block text-sm text-gray-600">Serial Number</strong>
      <span className="text-gray-900">
        {summary.serialNumber || <em className="text-gray-500">Not set</em>}
      </span>
    </p>
    <p>
      <strong className="block text-sm text-gray-600">Production Priority</strong>
      <span className="text-gray-900">
        {typeof summary.productionPriority === 'number'
          ? `#${summary.productionPriority}`
          : <em className="text-gray-500">Not assigned</em>}
      </span>
    </p>
  </div>
</div>

            {/* Logistics (factory + shipping) */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Logistics
              </h2>
              <p className="text-sm">
                <span className="font-semibold text-slate-800">Factory:</span>{' '}
                {summary.factory?.name || <em className="text-slate-500">Not assigned</em>}
              </p>
              <p className="text-sm mt-1">
                <span className="font-semibold text-slate-800">Shipping:</span>{' '}
                {summary.shippingMethod
                  ? SHIPPING_LABELS[summary.shippingMethod] || summary.shippingMethod
                  : <em className="text-slate-500">Not set</em>}
              </p>

              <button
                onClick={() => setEditing(true)}
                className="mt-3 inline-flex items-center text-xs font-semibold text-cyan-700 hover:text-cyan-800"
              >
                ✏️ Edit factory & shipping
              </button>
            </div>
          </div>

          {/* Delivery + hardware */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                Delivery Address
              </h3>
              <p className="text-sm text-slate-900 whitespace-pre-line">
                {summary.deliveryAddress}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-1">
                Hardware Selected
              </h3>
              <p className="text-sm text-slate-900">
                {hardwareSelected.length ? hardwareSelected.join(', ') : 'None'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit block (inline, no modal pantalla completa) */}
      {editing && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-cyan-900 uppercase tracking-wide">
            Edit Factory & Shipping
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Factory Location
              </label>
              <select
                value={selectedFactoryId}
                onChange={(e) => setSelectedFactoryId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={saving}
              >
                <option value="">Select a factory</option>
                {factoryList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.city ? ` — ${f.city}${f.state ? `, ${f.state}` : ''}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">
                Shipping Method
              </label>
              <select
                value={selectedShippingMethod}
                onChange={(e) => setSelectedShippingMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                disabled={saving}
              >
                <option value="">Select shipping method</option>
                <option value="PICK_UP">Pick Up</option>
                <option value="QUOTE">Shipping Quote</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-cyan-700 text-white font-semibold hover:bg-cyan-800 disabled:bg-cyan-400"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Manual Entry
        </button>
        {summary && summary.paymentProofUrl && (
          <a
            href={summary.paymentProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50"
          >
            View Payment Proof
          </a>
        )}
        <Link href={`/admin/orders/${orderId}/media`}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700">
            Upload Media
          </button>
        </Link>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
        {history.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
            No history found.
          </div>
        ) : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li
                key={h.id}
                className="border-l-4 border-cyan-700 pl-4 py-3 bg-white rounded-r-xl shadow-sm"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {STATUS_LABEL[h.status] || h.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(h.createdAt).toLocaleString()}
                  </p>
                </div>
                {h.comment && (
                  <p className="text-sm text-slate-700 mt-1">{h.comment}</p>
                )}
                {h.user && (
                  <p className="text-xs text-slate-400 mt-1">By: {h.user.email}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Media */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Uploaded Media</h2>
        {mediaFiles.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
            No media uploaded yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {mediaFiles.map((m) => (
              <div
                key={m.id}
                className="border border-slate-200 rounded-xl bg-white p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900 capitalize">
                    {m.type}
                  </p>
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View File
                  </a>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(m.uploadedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal manual history */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Add History Entry
            </h2>
            <form onSubmit={handleSubmitHistory}>
              <label className="block mb-4">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </span>
                <select
                  required
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">Select status</option>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block mb-6">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Comment (optional)
                </span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Add any notes for this status change…"
                />
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-700 text-white text-sm font-semibold hover:bg-cyan-800"
                >
                  Add Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}