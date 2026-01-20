'use client'

import { useEffect, useState } from 'react'

export default function DailyInventoryPage() {
  const [locationId, setLocationId] = useState<string | null>(null)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    if (!locationId) return
    fetch(`/api/admin/inventory/daily?locationId=${locationId}&date=2026-01-20`)
      .then(r => r.json())
      .then(setData)
  }, [locationId])

  if (!locationId) {
    return (
      <div className="p-4 space-x-4">
        <button onClick={() => setLocationId('Fort Plain')} className="border px-3 py-1">
          Fort Plain
        </button>
        <button onClick={() => setLocationId('Ashburn')} className="border px-3 py-1">
          Ashburn
        </button>
      </div>
    )
  }

  if (!data) return <div className="p-4">Loading…</div>

  return (
    <div className="p-4 text-sm">
      {data.categories.map((cat: any) => (
        <div key={cat.id} className="mb-6">
          <div className="font-bold border-b mb-2">
            {cat.name}
          </div>

          <table className="w-full border-collapse">
            <tbody>
              {cat.items.map((item: any) => (
                <tr key={item.id} className="border-b">
                  <td className="w-24">{item.sku}</td>
                  <td className="w-[40%]">{item.name}</td>
                  <td className="w-28">{item.unit}</td>
                  <td className="w-20">
                    <input className="w-16 border px-1" defaultValue={0} />
                  </td>
                  <td className="w-20">
                    <input className="w-16 border px-1" defaultValue={0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}