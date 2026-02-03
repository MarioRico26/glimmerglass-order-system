'use client'

import { useEffect, useMemo, useState } from 'react'

type Location = { id: string; name: string; type: string; active: boolean }
type ItemRow = {
  itemId: string
  sku: string
  item: string
  unit: string
  minStock: number
  category: string
  onHand: number
  qtyToOrder: number
}
type CategoryBlock = { name: string; items: ItemRow[] }

function yyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function DailyInventoryPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [date, setDate] = useState<string>(yyyyMmDd(new Date()))
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>('')

  const [sheetId, setSheetId] = useState<string>('')
  const [categories, setCategories] = useState<CategoryBlock[]>([])
  const [search, setSearch] = useState('')

  // cambios pendientes: key = itemId
  const [pending, setPending] = useState<Record<string, { onHand?: number; qtyToOrder?: number }>>({})

  const pendingCount = useMemo(() => Object.keys(pending).length, [pending])

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        const res = await fetch('/api/admin/inventory', { cache: 'no-store' })
        const json = await res.json()
        const locs = (json?.locations ?? []) as Location[]
        setLocations(locs)

        // default: Fort Plain si existe
        const fort = locs.find(l => l.name.toLowerCase() === 'fort plain')
        setLocationId((fort?.id ?? locs[0]?.id) || '')
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load locations')
      }
    })()
  }, [])

  async function loadDaily() {
    if (!locationId || !date) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(
        `/api/admin/inventory/daily?locationId=${encodeURIComponent(locationId)}&date=${encodeURIComponent(date)}`,
        { cache: 'no-store' }
      )
      const json = await res.json()

      if (!res.ok) throw new Error(json?.error ?? 'Failed to load')

      setSheetId(json?.sheetId ?? '')
      setCategories(json?.categories ?? [])
      setPending({}) // limpiar cambios al refrescar
    } catch (e: any) {
      setCategories([])
      setSheetId('')
      setError(e?.message ?? 'Failed to load daily inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!locationId) return
    loadDaily()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, date])

  function setCell(itemId: string, field: 'onHand' | 'qtyToOrder', value: number) {
    setPending(prev => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [field]: value },
    }))

    // optimista: actualiza UI local
    setCategories(prev =>
      prev.map(cat => ({
        ...cat,
        items: cat.items.map(it => {
          if (it.itemId !== itemId) return it
          return { ...it, [field]: value }
        }),
      }))
    )
  }

  async function save() {
    if (!pendingCount) return
    setSaving(true)
    setError('')
    try {
      const changes = Object.entries(pending).map(([itemId, vals]) => ({
        itemId,
        onHand: vals.onHand,
        qtyToOrder: vals.qtyToOrder,
      }))

      const res = await fetch('/api/admin/inventory/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, date, changes }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Save failed')

      setPending({})
      // opcional: reload para asegurar estado
      await loadDaily()
    } catch (e: any) {
      setError(e?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories

    const keepItem = (it: ItemRow) =>
      it.sku.toLowerCase().includes(q) ||
      it.item.toLowerCase().includes(q) ||
      it.unit.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q)

    return categories
      .map(c => ({ ...c, items: c.items.filter(keepItem) }))
      .filter(c => c.items.length > 0)
  }, [categories, search])

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl bg-white/80 p-8 shadow-xl ring-1 ring-black/5 backdrop-blur">
          <div className="flex flex-col gap-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-5xl font-black tracking-tight text-slate-900">
                  Daily Inventory Sheet
                </h1>
                <p className="mt-2 text-slate-600">
                  Fill <span className="font-semibold">QTY ON HAND</span> and{' '}
                  <span className="font-semibold">QTY TO ORDER</span>. Google Sheets vibes, but with less chaos.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  Pending changes: {pendingCount}
                </div>
                <button
                  onClick={save}
                  disabled={saving || pendingCount === 0}
                  className="rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-8 flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-600">Location</label>
                  <select
                    value={locationId}
                    onChange={e => setLocationId(e.target.value)}
                    className="h-12 w-72 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-semibold text-slate-600">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="h-12 w-48 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                  />
                </div>

                <button
                  onClick={loadDaily}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
                >
                  Refresh
                </button>

                <div className="text-sm text-slate-500">
                  Sheet: <span className="font-mono">{sheetId ? sheetId.slice(0, 8) : '—'}</span>
                </div>
              </div>

              <div className="lg:col-span-4">
                <label className="text-sm font-semibold text-slate-600">Search</label>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="SKU / item / category…"
                  className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-50 px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                <div className="col-span-2">SKU</div>
                <div className="col-span-5">Item</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-1 text-center">Min</div>
                <div className="col-span-1 text-center">On Hand</div>
                <div className="col-span-1 text-center">To Order</div>
              </div>

              {loading ? (
                <div className="p-10 text-center text-slate-600">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-slate-600">
                  No rows. Either your DB is empty, or you filtered everything into oblivion.
                </div>
              ) : (
                <div>
                  {filtered.map(cat => (
                    <div key={cat.name}>
                      <div className="bg-slate-100 px-5 py-3 text-sm font-extrabold text-slate-800">
                        {cat.name}
                      </div>

                      {cat.items.map(it => (
                        <div
                          key={it.itemId}
                          className="grid grid-cols-12 items-center gap-2 border-t border-slate-100 px-5 py-3 hover:bg-slate-50"
                        >
                          <div className="col-span-2 font-semibold text-slate-900">{it.sku}</div>
                          <div className="col-span-5 text-slate-900">{it.item}</div>
                          <div className="col-span-2 text-slate-600">{it.unit}</div>
                          <div className="col-span-1 text-center text-slate-600">{it.minStock}</div>

                          <div className="col-span-1 flex justify-center">
                            <input
                              type="number"
                              value={it.onHand ?? 0}
                              onChange={e => setCell(it.itemId, 'onHand', Number(e.target.value))}
                              className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                          </div>

                          <div className="col-span-1 flex justify-center">
                            <input
                              type="number"
                              value={it.qtyToOrder ?? 0}
                              onChange={e =>
                                setCell(it.itemId, 'qtyToOrder', Number(e.target.value))
                              }
                              className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-sm text-slate-500">
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}