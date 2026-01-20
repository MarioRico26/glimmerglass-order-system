'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Search, CalendarDays, CheckCircle2, AlertTriangle } from 'lucide-react'

type Location = { id: string; name: string; type: string; active: boolean }

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

type CategoryGroup = { name: string; items: Row[] }

type DailyPayload = {
  location: Location
  date: string // YYYY-MM-DD
  sheetId: string
  categories: CategoryGroup[]
}

function isoToday() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Google-Sheets-ish cell input:
 * - no border until focus
 * - subtle hover
 * - numeric only
 */
function CellNumberInput(props: {
  value: number
  onChange: (next: number) => void
  onCommit: () => void
  onNavigate: (dir: 'up' | 'down' | 'left' | 'right' | 'enter') => void
  busy?: boolean
  danger?: boolean
  placeholder?: string
}) {
  const { value, onChange, onCommit, onNavigate, busy, danger, placeholder } = props
  return (
    <input
      inputMode="numeric"
      value={Number.isFinite(value) ? String(value) : '0'}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d]/g, '')
        const n = raw === '' ? 0 : Number(raw)
        onChange(Number.isFinite(n) ? n : 0)
      }}
      onBlur={() => onCommit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(); onNavigate('enter'); return }
        if (e.key === 'ArrowDown') { e.preventDefault(); onNavigate('down'); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); onNavigate('up'); return }
        if (e.key === 'ArrowLeft') { onNavigate('left'); return }
        if (e.key === 'ArrowRight') { onNavigate('right'); return }
      }}
      className={cx(
        'w-full h-9 px-2 rounded-lg text-sm text-slate-900',
        'bg-transparent',
        'outline-none',
        'transition',
        'hover:bg-slate-50',
        'focus:bg-white focus:ring-2 focus:ring-sky-200 focus:shadow-[0_0_0_1px_rgba(2,132,199,.25)]',
        'border border-transparent focus:border-slate-200',
        danger && 'bg-rose-50/60 hover:bg-rose-50 focus:ring-rose-200',
        busy && 'opacity-70 cursor-wait',
      )}
      placeholder={placeholder}
    />
  )
}

export default function AdminInventoryDailyPage() {
  // locations
  const [locations, setLocations] = useState<Location[]>([])
  const [locationId, setLocationId] = useState<string>('')

  // date
  const [date, setDate] = useState<string>(isoToday())

  // data
  const [payload, setPayload] = useState<DailyPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ui
  const [q, setQ] = useState('')
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [savedPulse, setSavedPulse] = useState(0)
  const [dirtyCount, setDirtyCount] = useState(0)

  // Local editable cache: itemId -> { onHand, qtyToOrder }
  const localRef = useRef<Record<string, { onHand: number; qtyToOrder: number }>>({})
  const debounceRef = useRef<Record<string, any>>({})

  // Grid refs for keyboard nav
  const refMap = useRef<Record<string, HTMLInputElement | null>>({})

  const loadLocations = async () => {
    // only active locations; you can also filter type=FACTORY if you want
    const res = await fetch('/api/admin/inventory/locations?active=true', { cache: 'no-store' })
    const data = await safeJson<any>(res)
    const list: Location[] = data?.locations || []
    // keep only ACTIVE + (optional) hide non-factory if you want:
    const filtered = list.filter(l => l.active)
    setLocations(filtered)

    // auto select if empty
    if (!locationId && filtered.length) setLocationId(filtered[0].id)
  }

  const loadDaily = async (locId: string, d: string) => {
    if (!locId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/inventory/daily?locationId=${encodeURIComponent(locId)}&date=${encodeURIComponent(d)}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to load daily sheet'
        throw new Error(msg)
      }
      const data = await safeJson<DailyPayload>(res)
      if (!data) throw new Error('Invalid response')

      // hydrate local cache from server
      const nextCache: Record<string, { onHand: number; qtyToOrder: number }> = {}
      for (const cat of data.categories) {
        for (const r of cat.items) {
          nextCache[r.itemId] = { onHand: r.onHand ?? 0, qtyToOrder: r.qtyToOrder ?? 0 }
        }
      }
      localRef.current = nextCache
      setPayload(data)
      setDirtyCount(0)
    } catch (e: any) {
      setPayload(null)
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!locationId) return
    loadDaily(locationId, date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, date])

  const filteredCategories = useMemo(() => {
    if (!payload) return []
    const qq = q.trim().toLowerCase()
    if (!qq) return payload.categories

    const out: CategoryGroup[] = []
    for (const cat of payload.categories) {
      const rows = cat.items.filter(r => {
        return (
          r.category.toLowerCase().includes(qq) ||
          r.sku.toLowerCase().includes(qq) ||
          r.item.toLowerCase().includes(qq) ||
          r.unit.toLowerCase().includes(qq)
        )
      })
      if (rows.length) out.push({ name: cat.name, items: rows })
    }
    return out
  }, [payload, q])

  const setCellValue = (itemId: string, field: 'onHand' | 'qtyToOrder', value: number) => {
    const cur = localRef.current[itemId] || { onHand: 0, qtyToOrder: 0 }
    localRef.current[itemId] = { ...cur, [field]: value }
    setDirtyCount((c) => c + 1)
    setSavedPulse((x) => x + 1) // triggers rerender for table values
  }

  const commitCell = async (itemId: string, field: 'onHand' | 'qtyToOrder') => {
    const locId = locationId
    const d = date
    if (!locId || !payload) return

    const cellKey = `${itemId}:${field}`
    const cur = localRef.current[itemId] || { onHand: 0, qtyToOrder: 0 }

    // debounce flush
    if (debounceRef.current[cellKey]) {
      clearTimeout(debounceRef.current[cellKey])
      debounceRef.current[cellKey] = null
    }

    setSavingMap((m) => ({ ...m, [cellKey]: true }))

    try {
      const body: any = { locationId: locId, date: d, itemId }
      body[field] = Math.max(0, Math.floor(cur[field] ?? 0))

      const res = await fetch('/api/admin/inventory/daily', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to save'
        throw new Error(msg)
      }

      const saved = await safeJson<any>(res)
      // keep server-validated numbers
      if (saved) {
        const next = { ...(localRef.current[itemId] || { onHand: 0, qtyToOrder: 0 }) }
        if (saved.onHand !== undefined) next.onHand = saved.onHand
        if (saved.qtyToOrder !== undefined) next.qtyToOrder = saved.qtyToOrder
        localRef.current[itemId] = next
      }

      setDirtyCount((c) => Math.max(0, c - 1))
      setSavedPulse((x) => x + 1)
    } catch (e: any) {
      alert(e?.message || 'Could not save')
    } finally {
      setSavingMap((m) => {
        const n = { ...m }
        delete n[cellKey]
        return n
      })
    }
  }

  const scheduleCommit = (itemId: string, field: 'onHand' | 'qtyToOrder') => {
    const cellKey = `${itemId}:${field}`
    if (debounceRef.current[cellKey]) clearTimeout(debounceRef.current[cellKey])
    debounceRef.current[cellKey] = setTimeout(() => commitCell(itemId, field), 450)
  }

  const nav = (itemId: string, field: 'onHand' | 'qtyToOrder', dir: 'up'|'down'|'left'|'right'|'enter') => {
    // Build a linear order list for visible rows
    const order: Array<{ id: string }> = []
    for (const cat of filteredCategories) for (const r of cat.items) order.push({ id: r.itemId })

    const idx = order.findIndex(x => x.id === itemId)
    if (idx === -1) return

    const nextRow =
      dir === 'up' ? Math.max(0, idx - 1) :
      dir === 'down' ? Math.min(order.length - 1, idx + 1) :
      idx

    const nextField =
      dir === 'left' ? (field === 'qtyToOrder' ? 'onHand' : 'onHand') :
      dir === 'right' ? (field === 'onHand' ? 'qtyToOrder' : 'qtyToOrder') :
      dir === 'enter' ? 'onHand' : field

    const targetId =
      dir === 'enter' ? (order[Math.min(order.length - 1, idx + 1)]?.id || itemId)
      : order[nextRow]?.id

    const key = `${targetId}:${nextField}`
    const el = refMap.current[key]
    if (el) {
      el.focus()
      el.select?.()
    }
  }

  const headerSubtitle = useMemo(() => {
    if (!payload) return ''
    const name = payload.location?.name || ''
    return `${name} • ${payload.date}`
  }, [payload])

  return (
    <div className="min-h-[calc(100vh-6rem)]">
      {/* Top header */}
      <div className="rounded-2xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4 sm:p-5 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black rounded-full px-3 py-1 border border-slate-200 bg-white/80 text-slate-700">
              DAILY INVENTORY SHEET
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
              Inventory (factory daily)
            </h1>
            <div className="mt-1 text-sm text-slate-600">
              {headerSubtitle || 'Select location and date.'}
            </div>

            {error && (
              <div className="mt-2 inline-flex items-center gap-2 text-sm text-rose-700">
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                if (!locationId) return
                setRefreshing(true)
                await loadDaily(locationId, date)
                setRefreshing(false)
              }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            {/* Location */}
            <div className="h-10 rounded-xl border border-slate-200 bg-white px-2 flex items-center">
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="h-9 bg-transparent outline-none text-sm font-semibold text-slate-900"
              >
                {!locationId && <option value="">Select location</option>}
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div className="h-10 rounded-xl border border-slate-200 bg-white px-3 flex items-center gap-2">
              <CalendarDays size={16} className="text-slate-500" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 bg-transparent outline-none text-sm font-semibold text-slate-900"
              />
            </div>

            {/* Search */}
            <div className="h-10 rounded-xl border border-slate-200 bg-white px-3 flex items-center gap-2 min-w-[260px]">
              <Search size={16} className="text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search SKU / item / category..."
                className="w-full h-9 bg-transparent outline-none text-sm text-slate-900"
              />
            </div>

            {/* Status */}
            <div className="ml-1 inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span className={cx('inline-flex items-center gap-1', dirtyCount > 0 && 'text-amber-700')}>
                <span className={cx('h-2 w-2 rounded-full', dirtyCount > 0 ? 'bg-amber-500' : 'bg-emerald-500')} />
                {dirtyCount > 0 ? 'Saving…' : 'Saved'}
              </span>
              {dirtyCount === 0 && (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={14} /> ok
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.10)] overflow-hidden">
        <div className="max-h-[72vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-black tracking-wide text-slate-700 px-4 py-3 border-b border-slate-200 w-[140px]">SKU</th>
                <th className="text-left text-xs font-black tracking-wide text-slate-700 px-4 py-3 border-b border-slate-200">Item</th>
                <th className="text-left text-xs font-black tracking-wide text-slate-700 px-4 py-3 border-b border-slate-200 w-[160px]">Unit</th>
                <th className="text-left text-xs font-black tracking-wide text-slate-700 px-4 py-3 border-b border-slate-200 w-[180px]">QTY ON HAND</th>
                <th className="text-left text-xs font-black tracking-wide text-slate-700 px-4 py-3 border-b border-slate-200 w-[180px]">QTY TO ORDER</th>
              </tr>
            </thead>

            <tbody key={savedPulse /* forces refresh of displayed values */}>
              {!payload && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Select a location to load the daily sheet.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}

              {payload && filteredCategories.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No items match your search.
                  </td>
                </tr>
              )}

              {payload && filteredCategories.map((cat) => (
                <FragmentCategory
                  key={cat.name}
                  cat={cat}
                  savingMap={savingMap}
                  setCellValue={setCellValue}
                  scheduleCommit={scheduleCommit}
                  nav={nav}
                  refMap={refMap}
                  localRef={localRef}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-200 bg-white/70">
          Tip: Use Enter / arrows to fly through cells. Autosaves per cell. If internet dies mid-sheet… welcome to Earth.
        </div>
      </div>
    </div>
  )
}

function FragmentCategory(props: {
  cat: CategoryGroup
  savingMap: Record<string, boolean>
  setCellValue: (itemId: string, field: 'onHand'|'qtyToOrder', value: number) => void
  scheduleCommit: (itemId: string, field: 'onHand'|'qtyToOrder') => void
  nav: (itemId: string, field: 'onHand'|'qtyToOrder', dir: 'up'|'down'|'left'|'right'|'enter') => void
  refMap: React.MutableRefObject<Record<string, HTMLInputElement | null>>
  localRef: React.MutableRefObject<Record<string, { onHand: number; qtyToOrder: number }>>
}) {
  const { cat, savingMap, setCellValue, scheduleCommit, nav, refMap, localRef } = props

  return (
    <>
      {/* Category row */}
      <tr className="sticky top-[44px] z-10">
        <td colSpan={5} className="px-4 py-2 bg-slate-200/70 text-slate-900 font-black text-xs tracking-wide border-b border-slate-200">
          {cat.name}
        </td>
      </tr>

      {cat.items.map((r) => {
        const local = localRef.current[r.itemId] || { onHand: r.onHand ?? 0, qtyToOrder: r.qtyToOrder ?? 0 }
        const low = (local.onHand ?? 0) < (r.minStock ?? 0) && (r.minStock ?? 0) > 0

        const onHandKey = `${r.itemId}:onHand`
        const toOrderKey = `${r.itemId}:qtyToOrder`

        return (
          <tr key={r.itemId} className="group">
            <td className="px-4 py-2 border-b border-slate-100 font-semibold text-slate-900 align-middle">
              {r.sku}
            </td>

            <td className="px-4 py-2 border-b border-slate-100 align-middle">
              <div className="font-semibold text-slate-900">{r.item}</div>
              <div className="text-xs text-slate-500">
                Min stock: <span className={cx(low ? 'text-rose-700 font-bold' : 'text-slate-600')}>{r.minStock ?? 0}</span>
              </div>
            </td>

            <td className="px-4 py-2 border-b border-slate-100 text-slate-700 font-semibold align-middle">
              {r.unit}
            </td>

            <td className="px-4 py-2 border-b border-slate-100 align-middle">
              <div className={cx('rounded-xl border border-slate-200 bg-white', low && 'border-rose-200 bg-rose-50/40')}>
                <CellNumberInput
                  value={local.onHand ?? 0}
                  busy={!!savingMap[onHandKey]}
                  danger={low}
                  onChange={(n) => { setCellValue(r.itemId, 'onHand', n); scheduleCommit(r.itemId, 'onHand') }}
                  onCommit={() => scheduleCommit(r.itemId, 'onHand')}
                  onNavigate={(dir) => nav(r.itemId, 'onHand', dir)}
                />
              </div>
            </td>

            <td className="px-4 py-2 border-b border-slate-100 align-middle">
              <div className={cx('rounded-xl border border-slate-200 bg-white', (local.qtyToOrder ?? 0) > 0 && 'border-amber-200 bg-amber-50/40')}>
                <CellNumberInput
                  value={local.qtyToOrder ?? 0}
                  busy={!!savingMap[toOrderKey]}
                  onChange={(n) => { setCellValue(r.itemId, 'qtyToOrder', n); scheduleCommit(r.itemId, 'qtyToOrder') }}
                  onCommit={() => scheduleCommit(r.itemId, 'qtyToOrder')}
                  onNavigate={(dir) => nav(r.itemId, 'qtyToOrder', dir)}
                />
              </div>
            </td>

            {/* register refs for navigation */}
            <td className="hidden">
              <input
                ref={(el) => { refMap.current[onHandKey] = el }}
                aria-hidden
              />
              <input
                ref={(el) => { refMap.current[toOrderKey] = el }}
                aria-hidden
              />
            </td>
          </tr>
        )
      })}
    </>
  )
}