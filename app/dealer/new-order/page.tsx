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
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('')
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')
  const [comment, setComment] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // DEBUG: Ver el estado actual
  useEffect(() => {
    console.log('=== DEBUG ORDER HISTORY ===')
    console.log('Summary:', summary)
    console.log('Selected Factory:', selectedFactoryId)
    console.log('Selected Shipping:', selectedShippingMethod)
    console.log('Editing:', editing)
  }, [summary, selectedFactoryId, selectedShippingMethod, editing])

  // Cargar datos iniciales
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true)
        console.log('🔄 Fetching data for order:', orderId)
        
        const [orderRes, historyRes, mediaRes, factoriesRes] = await Promise.all([
          fetch(`/api/admin/orders/${orderId}/status`).then(res => {
            console.log('Order status response:', res.status)
            return res
          }),
          fetch(`/api/admin/orders/${orderId}/history`),
          fetch(`/api/admin/orders/${orderId}/media`),
          fetch(`/api/factories`)
        ])

        const orderData = await safeJson<OrderSummary>(orderRes)
        const historyData = await safeJson<OrderHistory[]>(historyRes)
        const mediaData = await safeJson<OrderMedia[]>(mediaRes)
        const factoriesData = await safeJson<FactoryLocation[]>(factoriesRes)

        console.log('📦 Order data received:', orderData)
        console.log('🏭 Factories received:', factoriesData)

        if (orderData) {
          setSummary(orderData)
          // 🔥 ESTABLECER VALORES INICIALES INMEDIATAMENTE
          setSelectedFactoryId(orderData.factory?.id || '')
          setSelectedShippingMethod(orderData.shippingMethod || '')
        } else {
          setMessage('❌ Failed to load order data')
        }
        
        if (Array.isArray(historyData)) {
          setHistory(historyData)
        } else if (historyData && Array.isArray((historyData as any)?.items)) {
          setHistory((historyData as any).items)
        }

        if (Array.isArray(mediaData)) {
          setMediaFiles(mediaData)
        } else if (mediaData && Array.isArray((mediaData as any)?.items)) {
          setMediaFiles((mediaData as any).items)
        }

        if (Array.isArray(factoriesData)) {
          setFactoryList(factoriesData)
        } else {
          setMessage('❌ Failed to load factories list')
        }

      } catch (error) {
        console.error('❌ Error fetching data:', error)
        setMessage('❌ Error loading order data')
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [orderId])

  // 🔥 Sincronizar cuando el summary cambia (por si acaso)
  useEffect(() => {
    if (summary) {
      console.log('🔄 Summary changed, syncing states')
      setSelectedFactoryId(summary.factory?.id || '')
      setSelectedShippingMethod(summary.shippingMethod || '')
    }
  }, [summary])

  const handleSaveChanges = async () => {
    try {
      setSaving(true)
      setMessage('🔄 Saving changes...')

      console.log('💾 Saving changes:', {
        factoryLocationId: selectedFactoryId,
        shippingMethod: selectedShippingMethod
      })

      const res = await fetch(`/api/admin/orders/${orderId}/factory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factoryLocationId: selectedFactoryId || null,
          shippingMethod: selectedShippingMethod || null,
        }),
      })
      
      console.log('📨 Save response:', res.status, res.statusText)

      if (res.ok) {
        const updated = await safeJson<OrderSummary>(res)
        console.log('✅ Save successful:', updated)
        
        if (updated) {
          setSummary(updated)
          setSelectedFactoryId(updated.factory?.id || '')
          setSelectedShippingMethod(updated.shippingMethod || '')
        }
        
        setEditing(false)
        setMessage('✅ Changes saved successfully!')
        
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorText = await res.text()
        console.error('❌ Save failed:', errorText)
        setMessage('❌ Error saving changes. Please try again.')
      }
    } catch (error) {
      console.error('❌ Save error:', error)
      setMessage('❌ Network error. Please check your connection.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    console.log('❌ Canceling edit, restoring values')
    if (summary) {
      setSelectedFactoryId(summary.factory?.id || '')
      setSelectedShippingMethod(summary.shippingMethod || '')
    }
    setEditing(false)
    setMessage('')
  }

  const handleStartEdit = () => {
    console.log('✏️ Starting edit with current values:', {
      factory: summary?.factory,
      shipping: summary?.shippingMethod
    })
    setEditing(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
        setMessage('✅ History entry added successfully!')
        
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(`❌ Failed to add history entry (${res.status})`)
      }
    } catch (error) {
      console.error('Submit error:', error)
      setMessage('❌ Network error. Please try again.')
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

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-gray-600">Loading order data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Order Details & History</h1>

      {message && (
        <div className={`px-4 py-3 rounded-lg mb-6 text-sm font-medium ${
          message.includes('✅') 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : message.includes('🔄') 
            ? 'bg-blue-50 border border-blue-200 text-blue-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {summary && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="font-semibold text-xl mb-6 pb-3 border-b text-gray-800">Order Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <p><strong className="text-gray-700 block text-sm">Dealer:</strong> {summary.dealer?.name || 'N/A'}</p>
              <p><strong className="text-gray-700 block text-sm">Model:</strong> {summary.poolModel?.name || 'N/A'}</p>
              <p><strong className="text-gray-700 block text-sm">Color:</strong> {summary.color?.name || 'N/A'}</p>
            </div>
            <div className="space-y-3">
              <p>
                <strong className="text-gray-700 block text-sm">Status:</strong> 
                <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium capitalize">
                  {STATUS_LABEL[summary.status] || summary.status.toLowerCase()}
                </span>
              </p>
              <p><strong className="text-gray-700 block text-sm">Hardware:</strong> {hardwareSelected.join(', ') || 'None'}</p>
            </div>
          </div>
          
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <strong className="text-gray-700 block text-sm mb-1">Delivery Address:</strong> 
            <span className="text-gray-900">{summary.deliveryAddress}</span>
          </div>

          {/* Sección de Factory & Shipping */}
          <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-lg border">
            <p>
              <strong className="text-gray-700">Factory Location:</strong> 
              <span className="ml-2 text-gray-900">
                {summary.factory?.name || <em className="text-gray-500">Not assigned</em>}
              </span>
            </p>
            <p>
              <strong className="text-gray-700">Shipping Method:</strong> 
              <span className="ml-2 text-gray-900">
                {summary.shippingMethod ? SHIPPING_LABELS[summary.shippingMethod] : <em className="text-gray-500">Not set</em>}
              </span>
            </p>
            <button
              onClick={handleStartEdit}
              className="text-cyan-700 hover:text-cyan-800 font-medium text-sm mt-2 flex items-center gap-1 transition-colors"
            >
              <span>✏️ Edit Factory & Shipping</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Edición */}
      {editing && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Edit Factory & Shipping</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Factory Location</label>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white"
                  disabled={saving}
                >
                  <option value="">Select a factory</option>
                  {factoryList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.city && `- ${f.city}, ${f.state}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Current: {summary?.factory?.name || 'Not assigned'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Selected ID: {selectedFactoryId || 'None'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700">Shipping Method</label>
                <select
                  value={selectedShippingMethod}
                  onChange={(e) => setSelectedShippingMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white"
                  disabled={saving}
                >
                  <option value="">Select shipping method</option>
                  <option value="PICK_UP">Pick Up</option>
                  <option value="QUOTE">Shipping Quote</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Current: {summary?.shippingMethod ? SHIPPING_LABELS[summary.shippingMethod] : 'Not set'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Selected: {selectedShippingMethod || 'None'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveChanges}
                disabled={saving}
                className="bg-cyan-700 text-white px-4 py-2 rounded-lg hover:bg-cyan-800 transition-colors font-medium disabled:bg-cyan-400"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botones de Acción */}
      <div className="flex gap-2 mb-8">
        <button 
          onClick={() => setShowModal(true)} 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Manual Entry
        </button>
        <Link href={`/admin/orders/${orderId}/media`}>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium">
            Upload Media
          </button>
        </Link>
        <Link href="/admin/orders">
          <button className="border border-gray-400 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium">
            Back to Orders
          </button>
        </Link>
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Timeline</h3>
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border">
            No history yet.
          </div>
        ) : (
          <ul className="space-y-4">
            {history.map((h) => (
              <li key={h.id} className="border-l-4 border-cyan-700 pl-4 py-3 bg-white rounded-r-lg shadow-sm">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-sm text-gray-800">{STATUS_LABEL[h.status] || h.status}</p>
                  <p className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
                {h.comment && (
                  <p className="text-sm text-gray-600 mt-1">{h.comment}</p>
                )}
                {h.user && (
                  <p className="text-xs text-gray-400 mt-1">By: {h.user.email}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Media Files */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Uploaded Media</h3>
        {mediaFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border">
            No media uploaded yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {mediaFiles.map((m) => (
              <div key={m.id} className="border rounded-lg p-3 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-800 capitalize">{m.type}</p>
                    <a 
                      href={m.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 text-sm hover:underline inline-block mt-1"
                    >
                      View File
                    </a>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(m.uploadedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para agregar entrada manual */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Add History Entry</h2>
            <form onSubmit={handleSubmit}>
              <label className="block mb-4">
                <span className="block text-sm font-semibold mb-2 text-gray-700">Status</span>
                <select
                  required
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">Select status</option>
                  {Object.entries(STATUS_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="block mb-6">
                <span className="block text-sm font-semibold mb-2 text-gray-700">Comment (optional)</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  placeholder="Add any comments or notes..."
                />
              </label>

              <div className="flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="bg-cyan-700 text-white px-4 py-2 rounded-lg hover:bg-cyan-800 transition-colors font-medium"
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