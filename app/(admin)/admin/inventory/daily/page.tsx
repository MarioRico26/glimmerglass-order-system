'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, CheckCircle2, RefreshCw, Search, Warehouse } from 'lucide-react'

type Maybe<T> = T | null | undefined

type Location = {
  id: string
  name: string
  type?: string
  factoryLocation?: Maybe<{ id: string; name: string }>
}

type Category = {
  id: string
  name: string
  active?: boolean
}

type Item = {
  id: string
  sku: string
  name: string
  unit: string
  minStock: number
  active: boolean
  category?: Maybe<{ id: string; name: string }>
}

type StockRow = {
  itemId: string
  onHand: number
}

type ReorderLine = {
  id: string
  itemId: string
  qtyToOrder: number
  item?: Maybe<{ id: string; sku: string; name: string; unit: string }>
}

type ReorderSheet = {
  id: string
  locationId: string
  date: string
  notes?: string | null
  createdAt?: string
  location?: Maybe<{ id: string; name: string; type?: string }>
  lines?: ReorderLine[]
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function toYmd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay = 450) {
  const t = useRef<any>(null)
  const lastFn = useRef(fn)
  lastFn.current = fn

  return (...args: Parameters<T>) => {
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => lastFn.current(...args), delay)
  }
}

export default function DailyInventorySheetPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])

  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [dateYmd, setDateYmd] = useState<string>(() => toYmd(new Date()))
  const [query, setQuery] = useState('')

  const [sheet, setSheet] = useState<ReorderSheet | null>(null)

  // local editable state
  const [onHand, setOnHand] = useState<Record<string, string>>({}) // itemId -> input string
  const [toOrder, setToOrder] = useState<Record<string, string>>({}) // itemId -> input string

  const [loading, setLoading] = useState(true)
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<string>('')

  const [refreshing, setRefreshing] = useState(false)

  const loadBootstrap = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [locRes, catRes, itemRes] = await Promise.all([
        fetch('/api/admin/inventory/locations', { cache: 'no-store' }),
        fetch('/api/admin/inventory/categories', { cache: 'no-store' }),
        fetch('/api/admin/inventory/items', { cache: 'no-store' }),
      ])

      const locData = await safeJson<{ items?: Location[] } | Location[]>(locRes)
      const catData = await safeJson<{ items?: Category[] } | Category[]>(catRes)
      const itemData = await safeJson<{ items?: Item[] } | Item[]>(itemRes)

      const locs = Array.isArray(locData) ? locData : (locData?.items ?? [])
      const cats = Array.isArray(catData) ? catData : (catData?.items ?? [])
      const its = Array.isArray(itemData) ? itemData : (itemData?.items ?? [])

      setLocations(locs)
      setCategories(cats)
      setItems(its)

      // default location
      if (!selectedLocationId && locs.length) {
        setSelectedLocationId(locs[0].id)
      }
    } catch (e) {
      setMessage('❌ Failed to load inventory setup data.')
    } finally {
      setLoading(false)
    }
  }

  const ensureSheetAndLoadData = async () => {
    if (!selectedLocationId || !dateYmd) return
    setMessage('')
    try {
      setRefreshing(true)

      // 1) get-or-create sheet for (locationId, date)
      const sheetRes = await fetch('/api/admin/inventory/reorder-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocationId, date: dateYmd }),
      })
      if (!sheetRes.ok) {
        const msg = (await safeJson<{ message?: string }>(sheetRes))?.message || 'Failed to create sheet'
        throw new Error(msg)
      }
      const createdSheet = await safeJson<ReorderSheet>(sheetRes)
      if (!createdSheet?.id) throw new Error('Invalid sheet response')

      // 2) load sheet detail (includes lines)
      const detailRes = await fetch(`/api/admin/inventory/reorder-sheets/${createdSheet.id}`, { cache: 'no-store' })
      if (!detailRes.ok) throw new Error('Failed to load sheet')
      const detail = await safeJson<ReorderSheet>(detailRes)

      // 3) load stocks for location
      const stockRes = await fetch(`/api/admin/inventory/stocks?locationId=${encodeURIComponent(selectedLocationId)}`, {
        cache: 'no-store',
      })
      if (!stockRes.ok) throw new Error('Failed to load stocks')
      const stockData = await safeJson<{ items?: StockRow[]; stocks?: StockRow[] } | StockRow[]>(stockRes)
      const stockList = Array.isArray(stockData)
        ? stockData
        : (stockData?.items ?? stockData?.stocks ?? [])

      // hydrate editable maps
      const onHandMap: Record<string, string> = {}
      stockList.forEach((s) => (onHandMap[s.itemId] = String(s.onHand ?? 0)))

      const toOrderMap: Record<string, string> = {}
      ;(detail?.lines ?? []).forEach((l) => (toOrderMap[l.itemId] = String(l.qtyToOrder ?? 0)))

      setSheet(detail ?? createdSheet)
      setOnHand(onHandMap)
      setToOrder(toOrderMap)
    } catch (e: any) {
      setMessage(`❌ ${e?.message || 'Failed to load daily sheet.'}`)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadBootstrap()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedLocationId) return
    ensureSheetAndLoadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId, dateYmd])

  const refreshAll = async () => {
    await ensureSheetAndLoadData()
  }

  const categoriesByName = useMemo(() => {
    const map = new Map<string, Category>()
    categories.forEach((c) => map.set(c.name, c))
    return map
  }, [categories])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = items.filter((it) => it.active !== false)
    if (!q) return base

    return base.filter((it) => {
      const cat = it.category?.name || ''
      return (
        it.name.toLowerCase().includes(q) ||
        it.sku.toLowerCase().includes(q) ||
        it.unit.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      )
    })
  }, [items, query])

  const grouped = useMemo(() => {
    // group by category name (fallback)
    const map: Record<string, Item[]> = {}
    filteredItems.forEach((it) => {
      const cat = it.category?.name || 'Uncategorized'
      ;(map[cat] ||= []).push(it)
    })
    // sort groups by category name (or you can do custom later)
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => a.name.localeCompare(b.name))
    })
    const keys = Object.keys(map).sort((a, b) => {
      // keep Uncategorized last
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })
    return { keys, map }
  }, [filteredItems])

  const setSaving = (key: string, v: boolean) => setSavingMap((p) => ({ ...p, [key]: v }))

  const saveOnHand = async (itemId: string, raw: string) => {
    const key = `onHand:${itemId}`
    setSaving(key, true)
    try {
      const n = raw === '' ? 0 : Number(raw)
      if (!Number.isFinite(n) || n < 0) throw new Error('On hand must be a number >= 0')

      const res = await fetch('/api/admin/inventory/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocationId,
          itemId,
          onHand: Math.floor(n),
        }),
      })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to save on hand'
        throw new Error(msg)
      }

      setMessage('✅ Saved')
      setTimeout(() => setMessage(''), 1200)
    } catch (e: any) {
      setMessage(`❌ ${e?.message || 'Failed to save on hand'}`)
    } finally {
      setSaving(key, false)
    }
  }

  const saveToOrder = async (itemId: string, raw: string) => {
    if (!sheet?.id) return
    const key = `toOrder:${itemId}`
    setSaving(key, true)
    try {
      const n = raw === '' ? 0 : Number(raw)
      if (!Number.isFinite(n) || n < 0) throw new Error('Qty to order must be a number >= 0')

      const res = await fetch(`/api/admin/inventory/reorder-sheets/${sheet.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          qtyToOrder: Math.floor(n),
        }),
      })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to save qty to order'
        throw new Error(msg)
      }

      setMessage('✅ Saved')
      setTimeout(() => setMessage(''), 1200)
    } catch (e: any) {
      setMessage(`❌ ${e?.message || 'Failed to save qty to order'}`)
    } finally {
      setSaving(key, false)
    }
  }

  const debouncedSaveOnHand = useDebouncedCallback(saveOnHand, 450)
  const debouncedSaveToOrder = useDebouncedCallback(saveToOrder, 450)

  const locationLabel = useMemo(() => {
    const loc = locations.find((l) => l.id === selectedLocationId)
    if (!loc) return 'Select location'
    const suffix = loc.factoryLocation?.name ? ` • ${loc.factoryLocation.name}` : ''
    return `${loc.name}${suffix}`
  }, [locations, selectedLocationId])

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-slate-600">Loading inventory…</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black rounded-full px-3 py-1 border border-slate-200 bg-white/80 text-slate-700">
              <Warehouse size={14} />
              DAILY INVENTORY SHEET
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900">
              Inventory sheet (factory daily)
            </h1>
            <p className="mt-2 text-slate-600">
              Fill <strong>QTY ON HAND</strong> and <strong>QTY TO ORDER</strong>. Saved automatically.
            </p>

            {message && (
              <div
                className={classNames(
                  'mt-3 inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold border',
                  message.startsWith('✅')
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : message.startsWith('❌')
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200',
                )}
              >
                <CheckCircle2 size={16} />
                {message}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                setRefreshing(true)
                await refreshAll()
                setRefreshing(false)
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
              Refresh
            </button>

            <div className="h-10 rounded-2xl border border-slate-200 bg-white px-3 inline-flex items-center gap-2">
              <Calendar size={16} className="text-slate-500" />
              <input
                type="date"
                value={dateYmd}
                onChange={(e) => setDateYmd(e.target.value)}
                className="bg-transparent outline-none text-sm font-semibold text-slate-900"
              />
            </div>

            <select
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.factoryLocation?.name ? ` — ${l.factoryLocation.name}` : ''}
                </option>
              ))}
            </select>

            <div className="h-10 rounded-2xl border border-slate-200 bg-white px-3 inline-flex items-center gap-2">
              <Search size={16} className="text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item / SKU / category…"
                className="bg-transparent outline-none text-sm w-56 max-w-[70vw]"
              />
            </div>

            <div
              className="h-1 w-28 rounded-full"
              style={{ backgroundImage: 'linear-gradient(90deg, #00B2CA, #007A99)' }}
            />
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Location:</span> {locationLabel} •{' '}
          <span className="font-semibold text-slate-900">Date:</span> {dateYmd}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50/80 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 w-[160px]">Category</th>
                <th className="text-left px-4 py-3 w-[140px]">Product # (SKU)</th>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3 w-[90px]">Unit</th>
                <th className="text-left px-4 py-3 w-[150px]">QTY ON HAND</th>
                <th className="text-left px-4 py-3 w-[150px]">QTY TO ORDER</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {grouped.keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No items match your search.
                  </td>
                </tr>
              ) : (
                grouped.keys.map((catName) => {
                  const list = grouped.map[catName] || []
                  return list.map((it, idx) => {
                    const showCat = idx === 0
                    const onHandKey = `onHand:${it.id}`
                    const toOrderKey = `toOrder:${it.id}`

                    return (
                      <tr key={it.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 align-top">
                          {showCat ? (
                            <div className="font-extrabold text-slate-900">{catName}</div>
                          ) : (
                            <div className="text-transparent select-none">.</div>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono text-[13px] text-slate-800">{it.sku}</td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{it.name}</div>
                          <div className="text-xs text-slate-500">
                            Min stock: <span className="font-semibold">{it.minStock ?? 0}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-700 font-semibold">{it.unit}</td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              value={onHand[it.id] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                setOnHand((p) => ({ ...p, [it.id]: v }))
                                debouncedSaveOnHand(it.id, v)
                              }}
                              inputMode="numeric"
                              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                              placeholder="0"
                            />
                            {savingMap[onHandKey] ? (
                              <div className="text-xs text-slate-500 w-14">Saving…</div>
                            ) : (
                              <div className="text-xs text-slate-400 w-14"> </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              value={toOrder[it.id] ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                setToOrder((p) => ({ ...p, [it.id]: v }))
                                debouncedSaveToOrder(it.id, v)
                              }}
                              inputMode="numeric"
                              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                              placeholder="0"
                            />
                            {savingMap[toOrderKey] ? (
                              <div className="text-xs text-slate-500 w-14">Saving…</div>
                            ) : (
                              <div className="text-xs text-slate-400 w-14"> </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-slate-500 border-t bg-white/60">
          Saved per change. If someone loses internet mid-sheet… welcome to humanity. Refresh fixes state.
        </div>
      </div>

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 1.2s linear infinite;
        }
      `}</style>
    </div>
  )
}