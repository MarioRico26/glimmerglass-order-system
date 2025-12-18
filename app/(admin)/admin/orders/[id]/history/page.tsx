//glimmerglass-order-system/app/(admin)/admin/orders/[id]/history/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

import AddManualEntryModal from '@/components/admin/AddManualEntry'

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
  docType?: string | null
  uploadedAt: string
}

interface OrderSummary {
  id: string
  deliveryAddress: string
  status: string
  paymentProofUrl?: string | null

  dealer?: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
  } | null

  poolModel?: { name: string } | null
  color?: { name: string } | null
  factory?: { id: string; name: string } | null
  shippingMethod?: string | null

  hardwareSkimmer: boolean
  hardwareReturns: boolean
  hardwareAutocover: boolean
  hardwareMainDrains: boolean

  requestedShipDate?: string | null
  serialNumber?: string | null
  productionPriority?: number | null
}

interface FactoryLocation {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
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
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

export default function OrderHistoryPage() {
  const params = useParams()
  const orderId = params.id as string

  const [summary, setSummary] = useState<OrderSummary | null>(null)
  const [history, setHistory] = useState<OrderHistory[]>([])
  const [mediaFiles, setMediaFiles] = useState<OrderMedia[]>([])
  const [factoryList, setFactoryList] = useState<FactoryLocation[]>([])

  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('')

  const [editRequestedDate, setEditRequestedDate] = useState<string>('') // yyyy-mm-dd
  const [editSerialNumber, setEditSerialNumber] = useState<string>('')
  const [editPriority, setEditPriority] = useState<string>('')

  const [editing, setEditing] = useState(false)

  // ✅ usa tu modal real
  const [manualOpen, setManualOpen] = useState(false)

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadAll = async () => {
    try {
      setLoading(true)

      const [orderRes, historyRes, mediaRes, factoriesRes] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/status`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/${orderId}/history`, { cache: 'no-store' }),
        fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' }),
        fetch(`/api/factories`, { cache: 'no-store' }),
      ])

      const orderData = await safeJson<OrderSummary>(orderRes)
      const historyData = await safeJson<OrderHistory[] | { items: OrderHistory[] }>(historyRes)
      const mediaData = await safeJson<OrderMedia[] | { items: OrderMedia[] }>(mediaRes)
      const factoriesData = await safeJson<FactoryLocation[]>(factoriesRes)

      if (orderData) {
        setSummary(orderData)

        setSelectedFactoryId(orderData.factory?.id || '')
        setSelectedShippingMethod(orderData.shippingMethod || '')

        if (orderData.requestedShipDate) {
          const d = new Date(orderData.requestedShipDate)
          setEditRequestedDate(!isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '')
        } else {
          setEditRequestedDate('')
        }

        setEditSerialNumber(orderData.serialNumber || '')
        setEditPriority(typeof orderData.productionPriority === 'number' ? String(orderData.productionPriority) : '')
      } else {
        setMessage('❌ Failed to load order data')
      }

      const historyList = Array.isArray(historyData)
        ? historyData
        : Array.isArray((historyData as any)?.items)
        ? (historyData as any).items
        : []
      setHistory(historyList)

      const mediaList = Array.isArray(mediaData)
        ? mediaData
        : Array.isArray((mediaData as any)?.items)
        ? (mediaData as any).items
        : []
      setMediaFiles(mediaList)

      if (Array.isArray(factoriesData)) setFactoryList(factoriesData)
    } catch (err) {
      console.error(err)
      setMessage('❌ Error loading order data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleSaveChanges = async () => {
    try {
      setSaving(true)
      setMessage('🔄 Saving changes...')

      const body = {
        factoryLocationId: selectedFactoryId || null,
        shippingMethod: selectedShippingMethod || null,
        requestedShipDate: editRequestedDate || null,
        serialNumber: editSerialNumber || null,
        productionPriority: editPriority ? Number(editPriority) : null,
      }

      const res = await fetch(`/api/admin/orders/${orderId}/factory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const updated = await safeJson<OrderSummary>(res)

      if (res.ok && updated) {
        setSummary(updated)
        setSelectedFactoryId(updated.factory?.id || '')
        setSelectedShippingMethod(updated.shippingMethod || '')

        setEditSerialNumber(updated.serialNumber || '')
        setEditPriority(typeof updated.productionPriority === 'number' ? String(updated.productionPriority) : '')

        if (updated.requestedShipDate) {
          const d = new Date(updated.requestedShipDate)
          setEditRequestedDate(!isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '')
        } else {
          setEditRequestedDate('')
        }

        setEditing(false)
        setMessage('✅ Changes saved successfully!')
      } else {
        setMessage('❌ Error saving changes. Please try again.')
      }
    } catch (error) {
      console.error('Save error:', error)
      setMessage('❌ Network error. Please check your connection.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-center items-center h-64 text-gray-600">
          Loading order data...
        </div>
      </div>
    )
  }

  const requestedShipText =
    summary?.requestedShipDate && !isNaN(new Date(summary.requestedShipDate).getTime())
      ? new Date(summary.requestedShipDate).toLocaleDateString()
      : 'Not set'

  const hardwareAllOff =
    !summary?.hardwareSkimmer &&
    !summary?.hardwareReturns &&
    !summary?.hardwareMainDrains &&
    !summary?.hardwareAutocover

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* ✅ tu modal real (y aquí el error ya sale dentro del modal, no “detrás”) */}
      <AddManualEntryModal
        orderId={orderId}
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={async () => {
          // refresca todo para que status + timeline + media queden actualizados
          await loadAll()
          setMessage('✅ Status updated.')
          setTimeout(() => setMessage(''), 2500)
        }}
      />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900">
          Order Details &amp; History
        </h1>
        <Link
          href="/admin/orders"
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to Orders
        </Link>
      </div>

      {summary && (
        <p className="text-xs text-slate-500 mb-4">
          Order ID: <span className="font-mono">{summary.id}</span>
        </p>
      )}

      {message && (
        <div
          className={`px-4 py-3 rounded-lg mb-6 text-sm font-medium ${
            message.includes('✅')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : message.includes('🔄')
              ? 'bg-blue-50 border border-blue-200 text-blue-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      {summary && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm mb-8">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Order Summary</span>
            </div>

            <div className="px-6 pt-4 pb-5 grid gap-6 md:grid-cols-4 text-sm text-slate-800">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Order
                </h3>
                <p>
                  <span className="font-semibold">Model:</span> {summary.poolModel?.name || 'Not set'}
                </p>
                <p>
                  <span className="font-semibold">Color:</span> {summary.color?.name || 'Not set'}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">Status:</span>{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                    {STATUS_LABEL[summary.status] || summary.status.replaceAll('_', ' ')}
                  </span>
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Dealer
                </h3>
                <p className="font-semibold">{summary.dealer?.name || 'Not set'}</p>

                {summary.dealer?.email && (
                  <p className="text-xs">
                    <span className="font-semibold">Email:</span>{' '}
                    <a href={`mailto:${summary.dealer.email}`} className="text-sky-700 hover:underline">
                      {summary.dealer.email}
                    </a>
                  </p>
                )}

                {summary.dealer?.phone && (
                  <p className="text-xs">
                    <span className="font-semibold">Phone:</span> {summary.dealer.phone}
                  </p>
                )}

                {(summary.dealer?.address || summary.dealer?.city || summary.dealer?.state) && (
                  <p className="text-xs">
                    <span className="font-semibold">Dealer Address:</span>{' '}
                    {[summary.dealer?.address, summary.dealer?.city, summary.dealer?.state]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Schedule
                </h3>
                <p>
                  <span className="font-semibold">Requested Ship Date:</span> {requestedShipText}
                </p>
                <p>
                  <span className="font-semibold">Serial Number:</span>{' '}
                  {summary.serialNumber ? summary.serialNumber : <span className="italic text-slate-500">Not set</span>}
                </p>
                <p>
                  <span className="font-semibold">Production Priority:</span>{' '}
                  {typeof summary.productionPriority === 'number'
                    ? <>#{summary.productionPriority}</>
                    : <span className="italic text-slate-500">Not assigned</span>}
                </p>
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Logistics
                </h3>
                <p>
                  <span className="font-semibold">Factory:</span>{' '}
                  {summary.factory?.name ? summary.factory.name : <span className="italic text-slate-500">Not assigned</span>}
                </p>
                <p>
                  <span className="font-semibold">Shipping:</span>{' '}
                  {summary.shippingMethod
                    ? (SHIPPING_LABELS[summary.shippingMethod] || summary.shippingMethod)
                    : <span className="italic text-slate-500">Not set</span>}
                </p>

                <button
                  onClick={() => setEditing(true)}
                  className="mt-2 text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline"
                >
                  ✏️ Edit factory, shipping &amp; production
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Delivery Address
                </div>
                <div className="text-slate-800">{summary.deliveryAddress}</div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Hardware Selected
                </div>

                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Skimmer', on: summary.hardwareSkimmer },
                    { label: 'Returns', on: summary.hardwareReturns },
                    { label: 'Main Drains', on: summary.hardwareMainDrains },
                    { label: 'Autocover', on: summary.hardwareAutocover },
                  ].map((h) => (
                    <span
                      key={h.label}
                      className={[
                        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border',
                        h.on
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-white text-slate-500 border-slate-200',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black',
                          h.on ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500',
                        ].join(' ')}
                      >
                        ✓
                      </span>
                      {h.label}
                    </span>
                  ))}
                </div>

                {hardwareAllOff && <p className="mt-2 text-xs text-slate-500">None selected.</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button
              onClick={() => setManualOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
            >
              + Manual Entry
            </button>

            {summary.paymentProofUrl && (
              <a
                href={summary.paymentProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                View Payment Proof
              </a>
            )}

            <Link
              href={`/admin/orders/${orderId}/media`}
              className="inline-flex bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
            >
              Upload Media
            </Link>
          </div>
        </>
      )}

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 text-slate-900">Timeline</h3>
        {history.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-500">
            No history found.
          </div>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li
                key={h.id}
                className="border-l-4 border-sky-600 pl-4 py-3 bg-white rounded-r-xl shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {STATUS_LABEL[h.status] || h.status.replaceAll('_', ' ')}
                    </p>
                    {h.comment && <p className="text-sm text-slate-700 mt-1">{h.comment}</p>}
                    {h.user && <p className="text-xs text-slate-400 mt-1">By: {h.user.email}</p>}
                  </div>
                  <p className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3 text-slate-900">Uploaded Media</h3>
        {mediaFiles.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-xl py-8 text-center text-sm text-slate-500">
            No media uploaded yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {mediaFiles.map((m) => (
              <div
                key={m.id}
                className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {m.docType ? m.docType.replaceAll('_', ' ') : m.type}
                  </p>
                  <a
                    href={m.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-700 hover:underline"
                  >
                    View File
                  </a>
                </div>
                <p className="text-xs text-slate-500">{new Date(m.uploadedAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4 text-slate-900">
              Edit logistics &amp; production
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">
                  Factory Location
                </label>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={saving}
                >
                  <option value="">Not assigned</option>
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.city ? ` — ${f.city}${f.state ? `, ${f.state}` : ''}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">
                  Shipping Method
                </label>
                <select
                  value={selectedShippingMethod}
                  onChange={(e) => setSelectedShippingMethod(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={saving}
                >
                  <option value="">Not set</option>
                  <option value="PICK_UP">Pick Up</option>
                  <option value="QUOTE">Shipping Quote</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">
                  Requested Ship Date
                </label>
                <input
                  type="date"
                  value={editRequestedDate}
                  onChange={(e) => setEditRequestedDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">
                  Serial Number
                </label>
                <input
                  type="text"
                  value={editSerialNumber}
                  onChange={(e) => setEditSerialNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-slate-700">
                  Production Priority
                </label>
                <input
                  type="number"
                  min={1}
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-sky-700 text-white text-sm font-semibold hover:bg-sky-800 disabled:bg-sky-400"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}