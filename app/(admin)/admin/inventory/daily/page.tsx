'use client'

import { useEffect, useState } from 'react'

type Item = {
  id: string
  sku: string
  name: string
  unit: string
  onHand: number
  qtyToOrder: number
}

type Data = {
  location: { id: string; name: string }
  date: string
  categories: Record<string, Item[]>
}

export default function InventoryDailyPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [location, setLocation] = useState('Fort Plain')
  const [date, setDate] = useState(today)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(
      `/api/admin/inventory/daily?locationId=${encodeURIComponent(location)}&date=${date}`,
      { cache: 'no-store' }
    )
    const json = await res.json()
    setData(json)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [location, date])

  async function updateQty(itemId: string, qty: number) {
    await fetch(`/api/admin/inventory/reorder-lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationName: location,
        date,
        itemId,
        qtyToOrder: qty,
      }),
    })
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={location}
          onChange={e => setLocation(e.target.value)}
          className="border px-3 py-2 rounded"
        >
          <option>Fort Plain</option>
          <option>Ashburn</option>
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border px-3 py-2 rounded"
        />
      </div>

      {loading && <div className="text-gray-500">Loading…</div>}

      {!loading && data && (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-3 py-2 w-32">SKU</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2 w-24">On Hand</th>
                <th className="text-right px-3 py-2 w-32">Qty to Order</th>
              </tr>
            </thead>

            <tbody>
              {Object.entries(data.categories).map(([category, items]) => (
                <>
                  <tr key={category}>
                    <td
                      colSpan={4}
                      className="bg-gray-200 font-semibold px-3 py-2 sticky top-10"
                    >
                      {category}
                    </td>
                  </tr>

                  {items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="px-3 py-2">{item.sku}</td>
                      <td className="px-3 py-2">
                        {item.name}
                        <span className="text-gray-400 ml-2">({item.unit})</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.onHand}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          defaultValue={item.qtyToOrder}
                          className="border rounded px-2 py-1 w-24 text-right"
                          onBlur={e =>
                            updateQty(item.id, Number(e.target.value))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}