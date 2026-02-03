// app/(admin)/admin/inventory/daily/page.tsx
"use client"

import React, { useEffect, useMemo, useState } from "react"

type Location = {
  id: string
  name: string
  type: string
  active: boolean
}

type Row = {
  itemId: string
  sku: string
  item: string
  unit: string
  minStock: number
  category: string
  onHand: number
  qtyToOrder: number
}

type CategoryBlock = {
  name: string
  items: Row[]
}

type DailyResponse = {
  location: Location
  date: string // YYYY-MM-DD
  sheetId: string
  categories: CategoryBlock[]
}

function yyyyMmDd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export default function AdminDailyInventoryPage() {
  // Cambia si tú tienes otras locations. Lo ideal: tener endpoint /locations, pero aquí no me voy a poner exquisito.
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState<string>("")
  const [date, setDate] = useState<string>(yyyyMmDd(new Date()))

  const [data, setData] = useState<DailyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>("")
  const [search, setSearch] = useState("")

  // pending changes: itemId -> partial
  const [changes, setChanges] = useState<Map<string, { onHand?: number; qtyToOrder?: number }>>(
    new Map()
  )

  const pendingCount = changes.size

  // Fetch locations from your own DB using the daily endpoint trick:
  // we’ll call /api/admin/inventory/daily?locationId=... only after we have locations.
  // So we need a proper locations endpoint, BUT if you don’t have it, we can load from DB with a tiny helper route later.
  // For now: try to fetch from a route you likely already have. If not, add it after this.
  useEffect(() => {
    ;(async () => {
      try {
        setError("")
        const res = await fetch("/api/admin/inventory/locations", { cache: "no-store" })
        if (!res.ok) {
          // fallback: show nothing but keep page usable
          return
        }
        const j = await res.json()
        const locs: Location[] = (j.locations ?? []).filter((l: Location) => l.active)
        setLocations(locs)
        if (!locationId && locs[0]?.id) setLocationId(locs[0].id)
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    if (!locationId || !date) {
      setError("Selecciona location y fecha.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(
        `/api/admin/inventory/daily?locationId=${encodeURIComponent(locationId)}&date=${encodeURIComponent(
          date
        )}`,
        { cache: "no-store" }
      )
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }
      const j = (await res.json()) as DailyResponse
      setData(j)
      setChanges(new Map()) // reset pending when reloading
    } catch (e: any) {
      console.error(e)
      setData(null)
      setError(e?.message || "Error cargando inventario.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (locationId) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId])

  const flatRows = useMemo(() => {
    if (!data) return []
    return data.categories.flatMap((c) => c.items.map((r) => ({ ...r, category: c.name })))
  }, [data])

  const filteredCategories = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    if (!q) return data.categories

    const match = (r: Row) => {
      return (
        r.sku.toLowerCase().includes(q) ||
        r.item.toLowerCase().includes(q) ||
        r.unit.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      )
    }

    return data.categories
      .map((c) => ({ ...c, items: c.items.filter(match) }))
      .filter((c) => c.items.length > 0)
  }, [data, search])

  function getEffectiveValue(itemId: string, key: "onHand" | "qtyToOrder", base: number) {
    const p = changes.get(itemId)
    const v = p?.[key]
    return typeof v === "number" && Number.isFinite(v) ? v : base
  }

  function setCell(itemId: string, key: "onHand" | "qtyToOrder", value: number) {
    setChanges((prev) => {
      const next = new Map(prev)
      const curr = next.get(itemId) ?? {}
      next.set(itemId, { ...curr, [key]: value })
      return next
    })
  }

  async function saveAll() {
    if (!data?.location?.id) {
      setError("No hay location cargada.")
      return
    }
    if (changes.size === 0) return

    setSaving(true)
    setError("")
    try {
      const payload = {
        locationId: data.location.id,
        date: data.date,
        changes: Array.from(changes.entries()).map(([itemId, v]) => ({
          itemId,
          onHand: v.onHand,
          qtyToOrder: v.qtyToOrder,
        })),
      }

      const res = await fetch("/api/admin/inventory/daily", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }

      // reload to reflect DB truth
      await load()
    } catch (e: any) {
      console.error(e)
      setError(e?.message || "Error guardando cambios.")
    } finally {
      setSaving(false)
    }
  }

  // Pretty header location name
  const selectedLocationName =
    locations.find((l) => l.id === locationId)?.name ?? data?.location?.name ?? "Select location"

  return (
    <div className="min-h-[calc(100vh-60px)] bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                Daily Inventory Sheet
              </h1>
              <p className="mt-2 text-slate-600">
                Google Sheets vibes, pero con menos caos y sin gente rompiendo fórmulas.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start">
              <div className="rounded-full border bg-slate-50 px-3 py-1 text-sm text-slate-700">
                Pending changes: <span className="font-semibold">{pendingCount}</span>
              </div>
              <button
                onClick={saveAll}
                disabled={saving || pendingCount === 0}
                className="rounded-2xl bg-black px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-black/10"
              >
                {locations.length === 0 ? (
                  <option value="">{selectedLocationName}</option>
                ) : (
                  locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>

            <div className="md:col-span-2 md:flex md:items-end">
              <button
                onClick={load}
                disabled={loading}
                className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            <div className="md:col-span-3">
              <label className="mb-2 block text-sm font-medium text-slate-700">Search</label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="SKU / item / category..."
                className="w-full rounded-2xl border px-4 py-3 text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-black/10"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="text-slate-600">
                    <th className="w-[140px] border-b px-4 py-3 font-semibold">SKU</th>
                    <th className="border-b px-4 py-3 font-semibold">ITEM</th>
                    <th className="w-[140px] border-b px-4 py-3 font-semibold">UNIT</th>
                    <th className="w-[180px] border-b px-4 py-3 font-semibold">QTY ON HAND</th>
                    <th className="w-[180px] border-b px-4 py-3 font-semibold">QTY TO ORDER</th>
                  </tr>
                </thead>

                <tbody>
                  {!data ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        {loading ? "Loading..." : "No data."}
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No matches.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((cat) => (
                      <React.Fragment key={cat.name}>
                        <tr className="bg-slate-100/70">
                          <td className="px-4 py-3 font-bold text-slate-800" colSpan={5}>
                            {cat.name}
                          </td>
                        </tr>

                        {cat.items.map((r) => {
                          const onHandVal = getEffectiveValue(r.itemId, "onHand", r.onHand)
                          const qtyVal = getEffectiveValue(r.itemId, "qtyToOrder", r.qtyToOrder)

                          return (
                            <tr key={r.itemId} className="hover:bg-slate-50">
                              <td className="border-b px-4 py-3 font-semibold text-slate-900">
                                {r.sku}
                              </td>
                              <td className="border-b px-4 py-3 text-slate-900">
                                {r.item}
                                {r.minStock > 0 ? (
                                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                                    Min {r.minStock}
                                  </span>
                                ) : null}
                              </td>
                              <td className="border-b px-4 py-3 text-slate-600">{r.unit}</td>

                              <td className="border-b px-4 py-3">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  value={onHandVal}
                                  onChange={(e) => setCell(r.itemId, "onHand", Number(e.target.value))}
                                  className="w-full rounded-xl border px-3 py-2 text-right shadow-sm outline-none focus:ring-2 focus:ring-black/10"
                                />
                              </td>

                              <td className="border-b px-4 py-3">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  value={qtyVal}
                                  onChange={(e) =>
                                    setCell(r.itemId, "qtyToOrder", Number(e.target.value))
                                  }
                                  className="w-full rounded-xl border px-3 py-2 text-right shadow-sm outline-none focus:ring-2 focus:ring-black/10"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Tip: edita varias celdas y dale <span className="font-semibold">Save</span> una sola vez.
            No estás jugando Candy Crush.
          </div>
        </div>
      </div>
    </div>
  )
}