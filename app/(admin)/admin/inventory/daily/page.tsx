'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Location = {
  id: string
  name: string
  type: string
  active: boolean
}

type ApiItem = {
  itemId: string
  sku: string
  item: string
  unit: string
  minStock: number
  category: string
  onHand: number
  qtyToOrder: number
}

type ApiCategory = {
  name: string
  items: ApiItem[]
}

type DailyResponse = {
  location: Location
  date: string
  sheetId: string | null
  categories: ApiCategory[]
}

function isoToday() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export default function DailyInventoryPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState<string>('')
  const [date, setDate] = useState<string>(isoToday())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<DailyResponse | null>(null)

  // edits keyed by itemId
  const [editsOnHand, setEditsOnHand] = useState<Record<string, number>>({})
  const [editsToOrder, setEditsToOrder] = useState<Record<string, number>>({})

  const [query, setQuery] = useState('')
  const gridRef = useRef<HTMLDivElement | null>(null)

  async function fetchLocations() {
    setError(null)
    try {
      const res = await fetch('/api/admin/inventory/locations?active=true', { cache: 'no-store' })
      const j = await res.json().catch(() => null)

      if (!res.ok) {
        setLocations([])
        setLocationId('')
        setError(j?.message || `Failed to load locations (${res.status})`)
        return
      }

      const locs: Location[] = (j?.locations || []) as Location[]
      setLocations(locs)
      if (!locationId && locs.length) setLocationId(locs[0].id)
    } catch (e: any) {
      setError(e?.message || 'Failed to load locations')
      setLocations([])
      setLocationId('')
    }
  }

  async function fetchDaily(nextLocId?: string, nextDate?: string) {
    const locId = nextLocId ?? locationId
    const d = nextDate ?? date
    if (!locId || !d) return

    setLoading(true)
    setError(null)

    try {
      const url = `/api/admin/inventory/daily?locationId=${encodeURIComponent(locId)}&date=${encodeURIComponent(d)}`
      const res = await fetch(url, { cache: 'no-store' })
      const j = (await res.json().catch(() => null)) as DailyResponse | null

      if (!res.ok || !j) {
        setData(null)
        setEditsOnHand({})
        setEditsToOrder({})
        setError((j as any)?.message || `Daily API error (${res.status})`)
        return
      }

      setData(j)

      // reset edits on refresh to reflect server truth
      setEditsOnHand({})
      setEditsToOrder({})
    } catch (e: any) {
      setData(null)
      setEditsOnHand({})
      setEditsToOrder({})
      setError(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Save: batch changes
  async function saveAll() {
    if (!data?.location?.id) return
    if (saving) return

    // build payload only for touched rows
    const itemIds = new Set([...Object.keys(editsOnHand), ...Object.keys(editsToOrder)])
    if (itemIds.size === 0) {
      setError('No changes to save.')
      return
    }

    const changes = Array.from(itemIds).map((itemId) => ({
      itemId,
      onHand: editsOnHand[itemId],
      qtyToOrder: editsToOrder[itemId],
    }))

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/inventory/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: data.location.id,
          date,
          changes,
        }),
      })

      const j = await res.json().catch(() => null)

      if (!res.ok) {
        setError(j?.message || `Save failed (${res.status})`)
        return
      }

      // refresh from server so the UI reflects snapshot truth
      await fetchDaily(data.location.id, date)
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (locationId) fetchDaily()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, date])

  const flatRows = useMemo(() => {
    if (!data) return []
    const rows: Array<ApiItem & { categoryName: string }> = []
    for (const c of data.categories || []) {
      for (const it of c.items || []) {
        rows.push({ ...it, categoryName: c.name })
      }
    }

    const q = query.trim().toLowerCase()
    if (!q) return rows

    return rows.filter((r) => {
      return (
        r.categoryName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.item.toLowerCase().includes(q) ||
        (r.unit || '').toLowerCase().includes(q)
      )
    })
  }, [data, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Array<ApiItem & { categoryName: string }>>()
    for (const r of flatRows) {
      const key = r.categoryName || 'Uncategorized'
      const arr = map.get(key) || []
      arr.push(r)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [flatRows])

  function getOnHandValue(r: ApiItem) {
    return editsOnHand[r.itemId] ?? r.onHand ?? 0
  }
  function getToOrderValue(r: ApiItem) {
    return editsToOrder[r.itemId] ?? r.qtyToOrder ?? 0
  }

  function setCellNumber(
    kind: 'onHand' | 'toOrder',
    itemId: string,
    value: string
  ) {
    const n = value === '' ? 0 : Number(value)
    const safe = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0

    if (kind === 'onHand') {
      setEditsOnHand((prev) => ({ ...prev, [itemId]: safe }))
    } else {
      setEditsToOrder((prev) => ({ ...prev, [itemId]: safe }))
    }
  }

  const pendingCount = useMemo(() => {
    const ids = new Set([...Object.keys(editsOnHand), ...Object.keys(editsToOrder)])
    return ids.size
  }, [editsOnHand, editsToOrder])

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="rounded-3xl bg-white/70 p-6 shadow-sm ring-1 ring-black/5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Daily Inventory Sheet</h1>
            <p className="mt-1 text-sm text-black/60">
              Fill <b>QTY ON HAND</b> and <b>QTY TO ORDER</b>. Google Sheets vibes, but with less chaos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-black/5 px-3 py-2 text-xs text-black/70">
              Pending changes: <b>{pendingCount}</b>
            </div>
            <button
              onClick={saveAll}
              disabled={saving || pendingCount === 0}
              className={cx(
                'h-11 rounded-xl px-5 text-sm font-semibold shadow-sm',
                pendingCount === 0
                  ? 'bg-black/10 text-black/40'
                  : 'bg-black text-white hover:bg-black/90',
                saving && 'opacity-70'
              )}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-black/60">Location</label>
            <select
              className="h-11 min-w-[240px] rounded-xl border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-black/10"
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

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-black/60">Date</label>
            <input
              type="date"
              className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-black/10"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button
            className="h-11 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold shadow-sm hover:bg-black/5 disabled:opacity-50"
            onClick={() => fetchDaily()}
            disabled={!locationId || loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          <div className="ml-auto flex flex-col gap-1">
            <label className="text-xs font-medium text-black/60">Search</label>
            <input
              className="h-11 w-[320px] rounded-xl border border-black/10 bg-white px-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-black/10"
              placeholder="SKU / item / category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 grid grid-cols-[150px_1fr_160px_160px_160px] gap-0 bg-black/[0.04] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-black/70">
            <div>SKU</div>
            <div>Item</div>
            <div>Unit</div>
            <div className="text-center">Qty on hand</div>
            <div className="text-center">Qty to order</div>
          </div>

          {loading && (
            <div className="px-4 py-12 text-center text-sm text-black/60">Loading…</div>
          )}

          {!loading && !data && (
            <div className="px-4 py-12 text-center text-sm text-black/60">
              No data loaded. (If Network shows JSON, your UI mapping is wrong.)
            </div>
          )}

          {!loading && data && grouped.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-black/60">
              No items matched your search.
            </div>
          )}

          <div ref={gridRef}>
            {!loading &&
              data &&
              grouped.map(([cat, list]) => (
                <div key={cat}>
                  <div className="bg-black/[0.06] px-4 py-2 text-sm font-semibold uppercase tracking-wide">
                    {cat}
                  </div>

                  {list.map((r) => (
                    <div
                      key={r.itemId}
                      className="grid grid-cols-[150px_1fr_160px_160px_160px] items-center gap-0 border-t border-black/5 px-4 py-2 text-sm"
                    >
                      <div className="font-medium tabular-nums">{r.sku}</div>

                      <div className="min-w-0">
                        <div className="truncate text-black/90">{r.item}</div>
                        {r.minStock > 0 && (
                          <div className="text-xs text-black/50">Min stock: {r.minStock}</div>
                        )}
                      </div>

                      <div className="text-black/70">{r.unit}</div>

                      {/* ✅ On Hand editable */}
                      <div className="flex justify-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="h-10 w-28 rounded-xl border border-black/10 bg-white px-3 text-center tabular-nums shadow-sm outline-none focus:ring-2 focus:ring-black/10"
                          value={getOnHandValue(r)}
                          onChange={(e) => setCellNumber('onHand', r.itemId, e.target.value)}
                        />
                      </div>

                      {/* ✅ Qty to Order editable */}
                      <div className="flex justify-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          className="h-10 w-28 rounded-xl border border-black/10 bg-white px-3 text-center tabular-nums shadow-sm outline-none focus:ring-2 focus:ring-black/10"
                          value={getToOrderValue(r)}
                          onChange={(e) => setCellNumber('toOrder', r.itemId, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
          </div>

          <div className="border-t border-black/10 bg-black/[0.02] px-4 py-3 text-xs text-black/60">
            Tip: edit multiple cells, then hit <b>Save</b> once.
          </div>
        </div>
      </div>
    </div>
  )
}