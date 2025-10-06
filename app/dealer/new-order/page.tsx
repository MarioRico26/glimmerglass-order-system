// app/(admin)/admin/orders/[id]/history/page.tsx
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
  factory?: { id: string; name: string }
  shippingMethod?: string
  hardwareSkimmer: boolean
  hardwareReturns: boolean
  hardwareAutocover: boolean
  hardwareMainDrains: boolean
}

interface FactoryLocation {
  id: string
  name: string
  city?: string
  state?: string
}

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending',
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
    return text ? JSON.parse(text) : null
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
  const [selectedFactoryId, setSelectedFactoryId] = useState('')
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchAll = async () => {
      const [s, h, m, f] = await Promise.all([
        fetch(`/api/admin/orders/${orderId}/status`).then(safeJson),
        fetch(`/api/admin/orders/${orderId}/history`).then(safeJson),
        fetch(`/api/admin/orders/${orderId}/media`).then(safeJson),
        fetch(`/api/factories`).then(safeJson),
      ])

      if (s) {
        const order = s as OrderSummary
        setSummary(order)
        setSelectedFactoryId(order.factory?.id || '')
        setSelectedShippingMethod(order.shippingMethod || '')
      }
      if (Array.isArray(h)) setHistory(h)
      else if (Array.isArray((h as any)?.items)) setHistory((h as any).items)

      if (Array.isArray(m)) setMediaFiles(m)
      else if (Array.isArray((m as any)?.items)) setMediaFiles((m as any).items)

      if (Array.isArray(f)) setFactoryList(f)
    }

    fetchAll()
  }, [orderId])

  const handleSaveChanges = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/factory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factoryLocationId: selectedFactoryId,
          shippingMethod: selectedShippingMethod,
        }),
      })
      const updated = await safeJson<OrderSummary>(res)
      if (res.ok && updated) {
        setSummary(updated)
        setEditing(false)
        setMessage('✅ Changes saved.')
      } else {
        setMessage('❌ Error saving changes.')
      }
    } catch {
      setMessage('❌ Error saving changes.')
    }
  }

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
      setMessage('✅ Entry added.')
    } else {
      setMessage(`❌ Failed to add history (${res.status})`)
    }
  }

  const hardwareSelected = useMemo(() => {
    if (!summary) return []
    const parts = []
    if (summary.hardwareSkimmer) parts.push('Skimmer')
    if (summary.hardwareReturns) parts.push('Returns')
    if (summary.hardwareAutocover) parts.push('Autocover')
    if (summary.hardwareMainDrains) parts.push('Main Drains')
    return parts
  }, [summary])

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Order History</h1>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}

      {summary && (
        <div className="bg-white border rounded p-4 mb-6 shadow">
          <h2 className="font-semibold text-lg mb-3">Order Summary</h2>
          <p><strong>Dealer:</strong> {summary.dealer?.name}</p>
          <p><strong>Model:</strong> {summary.poolModel?.name}</p>
          <p><strong>Color:</strong> {summary.color?.name}</p>
          <p><strong>Delivery Address:</strong> {summary.deliveryAddress}</p>
          <p><strong>Hardware:</strong> {hardwareSelected.join(', ') || 'None'}</p>

          {editing ? (
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-sm font-semibold">Factory Location</label>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">Select factory</option>
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold">Shipping Method</label>
                <select
                  value={selectedShippingMethod}
                  onChange={(e) => setSelectedShippingMethod(e.target.value)}
                  className="w-full border rounded px-2 py-1"
                >
                  <option value="">Select method</option>
                  <option value="PICK_UP">Pick Up</option>
                  <option value="QUOTE">Shipping Quote</option>
                </select>
              </div>

              <button
                onClick={handleSaveChanges}
                className="bg-cyan-700 text-white px-4 py-2 rounded hover:bg-cyan-800"
              >
                Save Changes
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-1">
              <p><strong>Factory Location:</strong> {summary.factory?.name || <em>Not assigned</em>}</p>
              <p><strong>Shipping Method:</strong> {summary.shippingMethod ? SHIPPING_LABELS[summary.shippingMethod] : <em>Not set</em>}</p>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-cyan-700 hover:underline mt-1"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded">
          + Manual Entry
        </button>
        <Link href={`/admin/orders/${orderId}/media`}>
          <button className="bg-green-600 text-white px-4 py-2 rounded">Upload Media</button>
        </Link>
        <Link href="/admin/orders">
          <button className="border border-gray-400 px-4 py-2 rounded">Back</button>
        </Link>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Timeline</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">No history yet.</p>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li key={h.id} className="border-l-4 border-cyan-700 pl-4">
                <p className="font-semibold text-sm">{STATUS_LABEL[h.status]}</p>
                <p className="text-sm">{h.comment}</p>
                <p className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Uploaded Media</h3>
        {mediaFiles.length === 0 ? (
          <p className="text-sm text-gray-500">No media uploaded yet.</p>
        ) : (
          <ul className="grid gap-2">
            {mediaFiles.map((m) => (
              <li key={m.id} className="border rounded p-2">
                <p className="text-sm font-medium">{m.type.toUpperCase()}</p>
                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">
                  View File
                </a>
                <p className="text-xs text-gray-500">{new Date(m.uploadedAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-md w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add History Entry</h2>
            <form onSubmit={handleSubmit}>
              <label className="block mb-2">
                <span>Status:</span>
                <select
                  required
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border px-2 py-1 mt-1 rounded"
                >
                  <option value="">Select status</option>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="block mb-4">
                <span>Comment (optional):</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full border px-2 py-1 mt-1 rounded"
                />
              </label>

              <div className="flex justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="mr-2 px-4 py-2 border rounded">
                  Cancel
                </button>
                <button type="submit" className="bg-cyan-700 text-white px-4 py-2 rounded">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}