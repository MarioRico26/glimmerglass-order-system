'use client'

import { useEffect, useState } from 'react'

type Location = {
  id: string
  name: string
}

type Row = {
  itemId: string
  sku: string
  name: string
  unit: string
  category: string
  onHand: number
  qtyToOrder: number
}

export default function InventoryDailyPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)

  // ===============================
  // LOAD LOCATIONS
  // ===============================
  useEffect(() => {
    fetch('/api/admin/inventory/locations?active=true')
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations || [])
        if (d.locations?.length === 1) {
          setLocationId(d.locations[0].id)
        }
      })
  }, [])

  // ===============================
  // LOAD DAILY SHEET
  // ===============================
  useEffect(() => {
    if (!locationId || !date) return

    setLoading(true)
    fetch(
      `/api/admin/inventory/daily?locationId=${locationId}&date=${date}`
    )
      .then(r => r.json())
      .then(d => {
        setRows(d.rows || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [locationId, date])

  // ===============================
  // UPDATE ON HAND
  // ===============================
  async function updateOnHand(itemId: string, value: number) {
    setRows(r =>
      r.map(row =>
        row.itemId === itemId ? { ...row, onHand: value } : row
      )
    )

    await fetch('/api/admin/inventory/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        locationId,
        newOnHand: value,
      }),
    })
  }

  // ===============================
  // UPDATE QTY TO ORDER
  // ===============================
  async function updateQtyToOrder(itemId: string, value: number) {
    setRows(r =>
      r.map(row =>
        row.itemId === itemId ? { ...row, qtyToOrder: value } : row
      )
    )

    await fetch('/api/admin/inventory/reorder-lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        date,
        itemId,
        qtyToOrder: value,
      }),
    })
  }

  // ===============================
  // GROUP BY CATEGORY (EXCEL STYLE)
  // ===============================
  const grouped = rows.reduce<Record<string, Row[]>>((acc, row) => {
    acc[row.category] = acc[row.category] || []
    acc[row.category].push(row)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-4">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <select
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Select location</option>
          {locations.map(l => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto border rounded bg-white">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="border px-2 py-2 text-left w-[120px]">SKU</th>
              <th className="border px-2 py-2 text-left">Item</th>
              <th className="border px-2 py-2 text-left w-[120px]">Unit</th>
              <th className="border px-2 py-2 text-center w-[140px]">
                QTY ON HAND
              </th>
              <th className="border px-2 py-2 text-center w-[140px]">
                QTY TO ORDER
              </th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center py-10 text-gray-400"
                >
                  Loading inventory…
                </td>
              </tr>
            )}

            {!loading &&
              Object.entries(grouped).map(([category, items]) => (
                <>
                  {/* CATEGORY ROW */}
                  <tr key={category}>
                    <td
                      colSpan={5}
                      className="bg-gray-200 font-semibold px-2 py-2"
                    >
                      {category}
                    </td>
                  </tr>

                  {items.map(row => (
                    <tr key={row.itemId}>
                      <td className="border px-2 py-1 font-mono">
                        {row.sku}
                      </td>
                      <td className="border px-2 py-1">
                        {row.name}
                      </td>
                      <td className="border px-2 py-1 text-gray-600">
                        {row.unit}
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          className="w-full border rounded px-2 py-1 text-right"
                          value={row.onHand}
                          onChange={e =>
                            updateOnHand(
                              row.itemId,
                              Number(e.target.value)
                            )
                          }
                        />
                      </td>
                      <td className="border px-2 py-1">
                        <input
                          type="number"
                          className="w-full border rounded px-2 py-1 text-right"
                          value={row.qtyToOrder}
                          onChange={e =>
                            updateQtyToOrder(
                              row.itemId,
                              Number(e.target.value)
                            )
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
    </div>
  )
}