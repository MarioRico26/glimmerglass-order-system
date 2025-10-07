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
      const res = await fetch(`/api/admin/orders/${orderId}/history`, { cache: 'no-store' })
      const data = await safeJson<OrderHistory[] | { items: OrderHistory[] }>(res)
      const list = Array.isArray(data) ? data : (data as any)?.items || []
      setHistory(list)
    }

    const fetchMedia = async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' })
      const data = await safeJson<OrderMedia[] | { items: OrderMedia[] }>(res)
      const list = Array.isArray(data) ? data : (data as any)?.items || []
      setMediaFiles(list)
    }

    const fetchFactories = async () => {
      const res = await fetch('/api/factories', { cache: 'no-store' })
      const data = await safeJson<FactoryLocation[]>(res)
      if (Array.isArray(data)) setFactoryList(data)
    }

    fetchSummary()
    fetchHistory()
    fetchMedia()
    fetchFactories()
  }, [orderId])
  const handleSaveChanges = async () => {
    if (!selectedFactoryId && !selectedShippingMethod) return

    const res = await fetch(`/api/admin/orders/${orderId}/factory`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        factoryId: selectedFactoryId || null,
        shippingMethod: selectedShippingMethod || null,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setError(err.message || 'Error saving changes')
      return
    }

    setMessage('Changes saved.')
    setEditing(false)
    router.refresh()
  }

  const hardwareList = useMemo(() => {
    if (!summary) return []
    const list = []
    if (summary.hardwareSkimmer) list.push('Skimmer')
    if (summary.hardwareReturns) list.push('Returns')
    if (summary.hardwareAutocover) list.push('Autocover')
    if (summary.hardwareMainDrains) list.push('Main Drains')
    return list.join(', ') || 'None'
  }, [summary])

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white shadow rounded-md">
      <h1 className="text-2xl font-bold border-b pb-2 mb-4">Order Details & History</h1>

      {message && (
        <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded mb-4">
          ✅ {message}
        </div>
      )}
      {error && (
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded mb-4">
          ❌ {error}
        </div>
      )}

      <div className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">Order Summary</h2>

        {summary ? (
          editing ? (
            <>
              <div className="mb-2">
                <label className="block font-medium mb-1">Factory Location</label>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select a factory</option>
                  {factoryList.map((factory) => (
                    <option key={factory.id} value={factory.id}>
                      {factory.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-2">
                <label className="block font-medium mb-1">Shipping Method</label>
                <select
                  value={selectedShippingMethod}
                  onChange={(e) => setSelectedShippingMethod(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select shipping method</option>
                  <option value="PICK_UP">Pick Up</option>
                  <option value="QUOTE">Quote</option>
                </select>
              </div>

              <button
                onClick={handleSaveChanges}
                className="mt-2 bg-cyan-800 text-white px-4 py-2 rounded hover:bg-cyan-700"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <p><strong>Dealer:</strong> {summary.dealer?.name || ''}</p>
              <p><strong>Model:</strong> {summary.poolModel?.name || ''}</p>
              <p><strong>Color:</strong> {summary.color?.name || ''}</p>
              <p>
                <strong>Factory Location:</strong>{' '}
                {summary.factory?.name || <em>Not assigned</em>}
              </p>
              <p>
                <strong>Shipping Method:</strong>{' '}
                {summary.shippingMethod
                  ? SHIPPING_METHOD_LABELS[summary.shippingMethod] || summary.shippingMethod
                  : <em>Not set</em>}
              </p>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-cyan-800 mt-1 underline"
              >
                Edit
              </button>
            </>
          )
        ) : (
          <p>Loading...</p>
        )}

        {summary && (
          <>
            <p className="mt-2"><strong>Delivery Address:</strong> {summary.deliveryAddress}</p>
            <p><strong>Hardware Selected:</strong> {hardwareList}</p>
          </>
        )}
      </div>
      <div className="flex gap-2 mb-6">
        <Link
          href={`/admin/orders/${orderId}/history/manual`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          + Manual Entry
        </Link>
        <Link
          href={`/admin/orders/${orderId}/media`}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          Upload Media
        </Link>
        <Link
          href="/admin/orders"
          className="border px-4 py-2 rounded text-gray-800 hover:bg-gray-100"
        >
          Back to Orders
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Timeline</h2>
        {history.length === 0 ? (
          <p className="text-gray-500">No history found.</p>
        ) : (
          <ul className="space-y-4">
            {history.map((entry) => (
              <li key={entry.id} className="border-l-4 border-cyan-800 pl-4">
                <div className="text-sm text-gray-600">
                  {format(new Date(entry.createdAt), 'MMM d, yyyy hh:mm a')}
                </div>
                <div className="font-medium">{entry.status}</div>
                {entry.comment && <div className="text-gray-700">{entry.comment}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Uploaded Media</h2>
        {media.length === 0 ? (
          <p className="text-gray-500">No media uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {media.map((item) => (
              <div key={item.id} className="border rounded p-2">
                {item.mediaType.startsWith('image') ? (
                  <Image
                    src={item.url}
                    alt="Uploaded"
                    width={300}
                    height={200}
                    className="rounded w-full object-cover"
                  />
                ) : (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    View File
                  </a>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {format(new Date(item.uploadedAt), 'MMM d, yyyy hh:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}