'use client'

import { useState } from 'react'

interface Props {
  orderId: string
  onSuccess: () => void
}

export default function AddManualEntryModal({ orderId, onSuccess }: Props) {
  const [status, setStatus] = useState('IN_PRODUCTION')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, comment })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Error creating entry')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded shadow bg-white">
      <h2 className="text-lg font-bold mb-2">Add Manual Entry</h2>

      <label className="block mb-2">
        <span>Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        >
          <option value="IN_PRODUCTION">In Production</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELED">Canceled</option>
        </select>
      </label>

      <label className="block mb-2">
        <span>Comment</span>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        />
      </label>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {loading ? 'Saving...' : 'Save Entry'}
      </button>
    </div>
  )
}