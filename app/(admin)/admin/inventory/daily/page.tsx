'use client'

import * as React from 'react'

type Location = { id: string; name: string }
type DailyRow = {
  itemId: string
  sku: string
  name: string
  unit: string
  minStock: number
  onHand: number
  qtyToOrder: number
}
type DailyGroup = { category: { id: string; name: string; sortOrder: number }; rows: DailyRow[] }

function isoToday() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  const text = await res.text()
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text || 'Invalid JSON')
  }
}

export default function AdminInventoryDailyPage() {
  const [locations, setLocations] = React.useState<Location[]>([])
  const [locationId, setLocationId] = React.useState<string>('')
  const [date, setDate] = React.useState<string>(isoToday())
  const [groups, setGroups] = React.useState<DailyGroup[]>([])
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string>('')

  // local edits cache (sheet-like)
  const editsRef = React.useRef(new Map<string, { onHand?: number; qtyToOrder?: number }>())

  async function loadLocations() {
    const data = await fetchJSON<{ locations: Array<{ id: string; name: string; active: boolean }> }>(
      `/api/admin/inventory/locations?active=true`
    )
    const list = (data.locations || []).map((l) => ({ id: l.id, name: l.name }))
    setLocations(list)
    // auto-select first
    if (!locationId && list.length) setLocationId(list[0].id)
  }

  async function loadDaily(locId: string, dt: string) {
    setLoading(true)
    setError('')
    try {
      const data = await fetchJSON<{ groups: DailyGroup[] }>(
        `/api/admin/inventory/daily?locationId=${encodeURIComponent(locId)}&date=${encodeURIComponent(dt)}`
      )
      setGroups(data.groups || [])
      editsRef.current.clear()
    } catch (e: any) {
      setError(e?.message || 'Failed to load daily sheet')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadLocations().catch((e) => setError(e?.message || 'Failed to load locations'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (locationId) loadDaily(locationId, date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, date])

  function updateCell(itemId: string, patch: { onHand?: number; qtyToOrder?: number }) {
    const prev = editsRef.current.get(itemId) || {}
    editsRef.current.set(itemId, { ...prev, ...patch })
    // instant UI update (optimistic)
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        rows: g.rows.map((r) =>
          r.itemId === itemId ? { ...r, ...patch } : r
        ),
      }))
    )
  }

  async function saveAll() {
    if (!locationId) return
    const updates = Array.from(editsRef.current.entries()).map(([itemId, v]) => ({
      itemId,
      ...(v.onHand !== undefined ? { onHand: v.onHand } : {}),
      ...(v.qtyToOrder !== undefined ? { qtyToOrder: v.qtyToOrder } : {}),
    }))
    if (!updates.length) return

    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/inventory/daily`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, date, updates }),
      })
      const text = await res.text()
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
      editsRef.current.clear()
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-zinc-600">Location</label>
        <select
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-zinc-600">Date</label>
        <input
          type="date"
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <button
        onClick={() => locationId && loadDaily(locationId, date)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-zinc-50"
        disabled={loading || !locationId}
      >
        {loading ? 'Loading…' : 'Refresh'}
      </button>

      <button
        onClick={saveAll}
        className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        disabled={saving || loading}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>

      {error ? (
        <div className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">
              Daily Inventory Sheet
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Fill <span className="font-semibold">QTY ON HAND</span> and{' '}
              <span className="font-semibold">QTY TO ORDER</span>. Looks like Excel, but less depressing.
            </p>
          </div>
        </div>

        {header}

        <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="max-h-[72vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-zinc-200">
                  <th className="w-[140px] px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-600">
                    Product # (SKU)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-600">
                    Item
                  </th>
                  <th className="w-[160px] px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-600">
                    Unit
                  </th>
                  <th className="w-[160px] px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-600">
                    QTY ON HAND
                  </th>
                  <th className="w-[160px] px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-600">
                    QTY TO ORDER
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <React.Fragment key={g.category.id}>
                      {/* Category row like Excel block header */}
                      <tr className="bg-zinc-100">
                        <td colSpan={5} className="px-3 py-2 text-xs font-black tracking-wide text-zinc-800">
                          {g.category.name}
                        </td>
                      </tr>

                      {g.rows.map((r) => (
                        <tr key={r.itemId} className="border-b border-zinc-100 hover:bg-zinc-50">
                          <td className="px-3 py-2 font-semibold text-zinc-900">{r.sku}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-zinc-900">{r.name}</div>
                            <div className="text-xs text-zinc-500">Min stock: {r.minStock}</div>
                          </td>
                          <td className="px-3 py-2 text-zinc-700">{r.unit}</td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.onHand ?? 0}
                              onChange={(e) => updateCell(r.itemId, { onHand: Math.max(0, Math.floor(Number(e.target.value || 0))) })}
                              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r.qtyToOrder ?? 0}
                              onChange={(e) =>
                                updateCell(r.itemId, { qtyToOrder: Math.max(0, Math.floor(Number(e.target.value || 0))) })
                              }
                              className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">
          Tip: edita varias celdas y dale <span className="font-semibold">Save</span> una vez. No estás jugando Candy Crush.
        </div>
      </div>
    </div>
  )
}