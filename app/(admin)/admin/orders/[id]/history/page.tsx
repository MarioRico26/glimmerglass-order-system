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

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  PICK_UP: 'Pick Up',
  QUOTE: 'Quote',
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
  const [factoryList, setFactoryList] = useState<FactoryLocation[]>([])
  const [selectedFactoryId, setSelectedFactoryId] = useState('')
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('')
  const [editing, setEditing] = useState(false)
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
      if (res.ok && data) {
        setSummary(data)
        setSelectedFactoryId(data.factory?.id || '')
        setSelectedShippingMethod(data.shippingMethod || '')
      }
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

    const fetchFactories = async () => {
      try {
        const res = await fetch('/api/factories', { cache: 'no-store' })
        const data = await safeJson<FactoryLocation[]>(res)
        if (Array.isArray(data)) setFactoryList(data)
      } catch (err) {
        console.error('Error loading factories', err)
      }
    }

    fetchSummary()
    fetchHistory()
    fetchMedia()
    fetchFactories()
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

      if (!res.ok) throw new Error('Failed to update')

      const updated = await safeJson<OrderSummary>(res)
      if (updated) {
        setSummary(updated)
        setEditing(false)
        setMessage('✅ Changes saved.')
      }
    } catch (err: any) {
      console.error(err)
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 border-b pb-1 border-cyan-700 flex justify-between items-center">
        Order Details & History
        <span className="h-1 w-20 bg-cyan-600 block rounded-full"></span>
      </h1>

      {message && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded mb-4 text-sm">
          {message}
        </div>
      )}

      {summary && (
        <div className="bg-white rounded-lg p-4 border border-gray-300 mb-6 shadow-sm">
          <h2 className="font-semibold text-md mb-3">Order Summary</h2>
          <p className="mb-1">
            <strong>Dealer:</strong> {summary.dealer?.name}
          </p>
          <p className="mb-1">
            <strong>Model:</strong> {summary.poolModel?.name}
          </p>
          <p className="mb-1">
            <strong>Color:</strong> {summary.color?.name}
          </p>

          {editing ? (
            <>
              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Factory Location</label>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="w-full border border-gray-300 px-2 py-1 rounded"
                >
                  <option value="">Select a factory</option>
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label className="block text-sm font-semibold mb-1">Shipping Method</label>
                <select
                  value={selectedShippingMethod}
                  onChange={(e) => setSelectedShippingMethod(e.target.value)}
                  className="w-full border border-gray-300 px-2 py-1 rounded"
                >
                  <option value="">Select shipping method</option>
                  <option value="PICK_UP">Pick Up</option>
                  <option value="QUOTE">Send Me a Shipping Quote</option>
                </select>
              </div>

              <button
                onClick={handleSaveChanges}
                className="bg-cyan-700 text-white px-4 py-2 mt-2 rounded hover:bg-cyan-800 transition"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <p className="mb-1">
                <strong>Factory Location:</strong>{' '}
                {summary.factory?.name || <em>Not assigned</em>}
              </p>
              <p className="mb-2">
                <strong>Shipping Method:</strong>{' '}
                {summary.shippingMethod ? SHIPPING_METHOD_LABELS[summary.shippingMethod] : <em>Not set</em>}
              </p>
              <button
                onClick={() => setEditing(true)}
                className="text-cyan-700 hover:underline text-sm font-semibold"
              >
                Edit
              </button>
            </>
          )}

          <p className="mt-3 mb-1">
            <strong>Delivery Address:</strong> {summary.deliveryAddress}
          </p>
          <p className="mb-1">
            <strong>Hardware Selected:</strong>{' '}
            {hardwareSelected.length ? hardwareSelected.join(', ') : 'None'}
          </p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          + Manual Entry
        </button>
        <Link href={`/admin/orders/${orderId}/media`}>
          <button className="bg-green-600 text-white px-4 py-2 rounded">Upload Media</button>
        </Link>
        <Link href="/admin/orders">
          <button className="border border-gray-400 px-4 py-2 rounded">Back to Orders</button>
        </Link>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Timeline</h3>
        {history.length === 0 ? (
          <p className="text-gray-500 text-sm">No history found.</p>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li key={h.id} className="border-l-4 pl-4 border-cyan-700">
                <p className="text-sm font-semibold">{STATUS_LABEL[h.status]}</p>
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
          <p className="text-gray-500 text-sm">No media uploaded yet.</p>
        ) : (
          <ul className="grid gap-2">
            {mediaFiles.map((m) => (
              <li key={m.id} className="border border-gray-200 rounded p-2">
                <p className="text-sm">{m.type.toUpperCase()}</p>
                <a
                  href={m.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  View File
                </a>
                <p className="text-xs text-gray-400">
                  {new Date(m.uploadedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add History Entry</h2>
            <form onSubmit={handleSubmit}>
              <label className="block mb-2">
                <span>Status:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border px-2 py-1 mt-1 rounded"
                  required
                >
                  <option value="">Select status</option>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block mb-2 mt-3">
                <span>Comment (optional):</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full border px-2 py-1 mt-1 rounded"
                />
              </label>

              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mr-2 px-4 py-2 border rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="bg-cyan-700 text-white px-4 py-2 rounded">
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
