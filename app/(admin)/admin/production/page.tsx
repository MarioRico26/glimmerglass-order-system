'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Factory,
  GripVertical,
  Hash,
  Layers3,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

type Maybe<T> = T | null | undefined

type OrderStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

type DisplayMode = 'BOARD' | 'CALENDAR'
type CalendarMode = 'WEEK' | 'MONTH'

interface Order {
  id: string
  deliveryAddress: string
  status: OrderStatus
  paymentProofUrl?: string | null
  poolModel: Maybe<{
    name: string
    defaultFactoryLocation?: { id: string; name: string } | null
  }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factoryLocation: Maybe<{ name: string }>
  createdAt?: string
  requestedShipDate?: string | null
  productionPriority?: number | null
  scheduledProductionDate?: string | null
}

type ApiOrders = { items: Order[]; total?: number } | Order[]

const UNSCHEDULED_KEY = 'UNSCHEDULED'
const OUTSIDE_PERIOD_KEY = 'OUTSIDE_PERIOD'
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(+dt)) return '—'
  return dt.toLocaleDateString()
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  if (Number.isNaN(+dt)) return '—'
  return dt.toLocaleString()
}

function cloneUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function startOfWeekUTC(base = new Date()) {
  const d = cloneUTC(base)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function addDaysUTC(base: Date, days: number) {
  const next = new Date(base)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addMonthsUTC(base: Date, months: number) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1))
}

function startOfMonthUTC(base = new Date()) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1))
}

function dayKeyUTC(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(+date)) return ''
  return date.toISOString().slice(0, 10)
}

function buildMonthCells(focusedDate: Date) {
  const monthStart = startOfMonthUTC(focusedDate)
  const gridStart = startOfWeekUTC(monthStart)
  return Array.from({ length: 42 }, (_, i) => addDaysUTC(gridStart, i))
}

function periodLabel(viewMode: CalendarMode, focusedDate: Date) {
  if (viewMode === 'WEEK') {
    const start = startOfWeekUTC(focusedDate)
    const end = addDaysUTC(start, 6)
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
  }
  return focusedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function statusPill(status: OrderStatus) {
  const base = 'px-2 py-0.5 rounded-full text-[11px] font-bold border leading-none'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>Needs Deposit</span>
    case 'IN_PRODUCTION':
      return <span className={`${base} bg-indigo-50 text-indigo-800 border-indigo-200`}>In Production</span>
    case 'PRE_SHIPPING':
      return <span className={`${base} bg-violet-50 text-violet-800 border-violet-200`}>Pre-Ship</span>
    case 'COMPLETED':
      return <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>Completed</span>
    case 'CANCELED':
      return <span className={`${base} bg-rose-50 text-rose-800 border-rose-200`}>Canceled</span>
    default:
      return <span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>{status}</span>
  }
}

function resolveFactoryName(order: Order) {
  return (
    order.factoryLocation?.name ||
    order.poolModel?.defaultFactoryLocation?.name ||
    'Unassigned Factory'
  )
}

function sortKey(o: Order) {
  const p = typeof o.productionPriority === 'number' ? o.productionPriority : 999999
  const productionDate = o.scheduledProductionDate ? +new Date(o.scheduledProductionDate) : 9999999999999
  const ship = o.requestedShipDate ? +new Date(o.requestedShipDate) : 9999999999999
  const created = o.createdAt ? +new Date(o.createdAt) : 0
  return [p, productionDate, ship, -created, o.id]
}

function compareKeys(a: Array<number | string>, b: Array<number | string>) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

function compareOrders(a: Order, b: Order) {
  return compareKeys(sortKey(a), sortKey(b))
}

export default function ProductionSchedulePage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)
  const [compact, setCompact] = useState(false)
  const [fs, setFs] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('BOARD')
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('WEEK')
  const [focusedDate, setFocusedDate] = useState<Date>(() => cloneUTC(new Date()))
  const [filter, setFilter] = useState('')

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)

  const dragRef = useRef<{ id: string; fromFactory: string } | null>(null)
  const [draggingCalendarId, setDraggingCalendarId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '200',
        status: 'IN_PRODUCTION',
        sort: 'productionPriority',
        dir: 'asc',
      })
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to load production queue'
        throw new Error(msg)
      }
      const data = await safeJson<ApiOrders>(res)
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      setOrders(list.filter((o) => o.status === 'IN_PRODUCTION'))
    } catch (e: unknown) {
      setOrders([])
      setError(e instanceof Error ? e.message : 'Failed to load production queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!auto) return
    const t = setInterval(async () => {
      setRefreshing(true)
      await load()
      setRefreshing(false)
    }, 20000)
    return () => clearInterval(t)
  }, [auto])

  const toggleFS = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setFs(true)
      } else {
        await document.exitFullscreen()
        setFs(false)
      }
    } catch {}
  }

  const filteredOrders = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => {
      const haystack = [
        o.poolModel?.name,
        o.color?.name,
        o.dealer?.name,
        resolveFactoryName(o),
        o.deliveryAddress,
        o.productionPriority?.toString(),
        o.requestedShipDate,
        o.scheduledProductionDate,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [orders, filter])

  const stats = useMemo(() => {
    const total = filteredOrders.length
    const noPriority = filteredOrders.filter((o) => typeof o.productionPriority !== 'number').length
    const scheduled = filteredOrders.filter((o) => !!o.scheduledProductionDate).length
    const unscheduled = total - scheduled
    return { total, noPriority, prioritized: total - noPriority, scheduled, unscheduled }
  }, [filteredOrders])

  const factories = useMemo(() => {
    const s = new Set<string>()
    filteredOrders.forEach((o) => s.add(resolveFactoryName(o)))
    return Array.from(s).sort()
  }, [filteredOrders])

  const byFactory = useMemo(() => {
    const map: Record<string, Order[]> = {}
    factories.forEach((f) => (map[f] = []))
    filteredOrders.forEach((o) => {
      const f = resolveFactoryName(o)
      ;(map[f] ||= []).push(o)
    })
    Object.keys(map).forEach((f) => map[f].sort(compareOrders))
    return map
  }, [filteredOrders, factories])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysUTC(startOfWeekUTC(focusedDate), i)), [focusedDate])
  const monthCells = useMemo(() => buildMonthCells(focusedDate), [focusedDate])
  const visibleDates = calendarMode === 'WEEK' ? weekDays : monthCells
  const visibleKeys = useMemo(() => visibleDates.map((d) => dayKeyUTC(d)), [visibleDates])
  const monthAnchorKey = `${startOfMonthUTC(focusedDate).getUTCFullYear()}-${startOfMonthUTC(focusedDate).getUTCMonth()}`

  const calendarGroups = useMemo(() => {
    const map: Record<string, Order[]> = {
      [UNSCHEDULED_KEY]: [],
      [OUTSIDE_PERIOD_KEY]: [],
    }
    for (const key of visibleKeys) map[key] = []

    for (const order of filteredOrders) {
      const key = dayKeyUTC(order.scheduledProductionDate)
      if (!key) {
        map[UNSCHEDULED_KEY].push(order)
        continue
      }
      if (visibleKeys.includes(key)) {
        map[key].push(order)
        continue
      }
      map[OUTSIDE_PERIOD_KEY].push(order)
    }

    Object.keys(map).forEach((key) => map[key].sort(compareOrders))
    return map
  }, [filteredOrders, visibleKeys])

  const openModal = (o: Order) => {
    setActive(o)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (modalRef.current && !modalRef.current.contains(t)) closeModal()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const saveSchedule = async (
    id: string,
    productionPriority: number | null,
    requestedShipDate: string | null,
    scheduledProductionDate: string | null
  ) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionPriority, requestedShipDate, scheduledProductionDate }),
      })
      if (!res.ok) throw new Error((await safeJson<{ message?: string }>(res))?.message || 'Failed to save')

      const updated = await safeJson<Order>(res)
      if (updated?.id) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updated } : o)))
        setActive((prev) => (prev?.id === id ? { ...prev, ...updated } : prev))
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not save schedule')
    } finally {
      setBusy(false)
    }
  }

  async function persistBatchPriorities(updates: Array<{ id: string; productionPriority: number | null }>) {
    const res = await fetch(`/api/admin/orders/schedule/batch`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
    if (!res.ok) {
      const payload = await safeJson<{ message?: string }>(res)
      throw new Error(payload?.message || 'Failed to save production order')
    }
  }

  const normalizeFactoryPriorities = async (factoryName: string) => {
    const list = [...(byFactory[factoryName] || [])]
    if (list.length === 0) return
    const updates = list.map((o, i) => ({ id: o.id, productionPriority: i + 1 }))

    setOrders((prev) => {
      const map = new Map(prev.map((o) => [o.id, o] as const))
      for (const u of updates) {
        const current = map.get(u.id)
        if (current) map.set(u.id, { ...current, productionPriority: u.productionPriority })
      }
      return Array.from(map.values())
    })

    try {
      await persistBatchPriorities(updates)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not normalize priorities')
      await load()
    }
  }

  const onBoardDragStart = (id: string, fromFactory: string) => {
    dragRef.current = { id, fromFactory }
  }

  const onBoardDrop = async (toId: string, toFactory: string) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.fromFactory !== toFactory) return

    const list = [...(byFactory[toFactory] || [])]
    const fromIdx = list.findIndex((o) => o.id === drag.id)
    const toIdx = list.findIndex((o) => o.id === toId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return

    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)

    const updates = list.map((o, i) => ({ id: o.id, productionPriority: i + 1 }))

    setOrders((prev) => {
      const map = new Map(prev.map((o) => [o.id, o]))
      updates.forEach((u) => {
        const cur = map.get(u.id)
        if (cur) map.set(u.id, { ...cur, productionPriority: u.productionPriority })
      })
      return Array.from(map.values())
    })

    try {
      await persistBatchPriorities(updates)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not save new order')
      await load()
    }
  }

  const onDropToProductionDate = async (dayKey: string) => {
    if (!draggingCalendarId) return
    const orderId = draggingCalendarId
    setDraggingCalendarId(null)
    await saveSchedule(orderId, null, null, `${dayKey}T12:00:00.000Z`)
  }

  const onDropToUnscheduled = async () => {
    if (!draggingCalendarId) return
    const orderId = draggingCalendarId
    setDraggingCalendarId(null)
    await saveSchedule(orderId, null, null, null)
  }

  const navigatePeriod = (direction: -1 | 1) => {
    setFocusedDate((prev) =>
      calendarMode === 'WEEK' ? addDaysUTC(prev, direction * 7) : addMonthsUTC(prev, direction)
    )
  }

  return (
    <div
      className="min-h-screen p-4 xl:p-5"
      style={{
        background: `radial-gradient(1100px 700px at 80% 0%, #E6F7FA 0%, transparent 60%),
          radial-gradient(800px 500px at 10% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
          linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      <div className="rounded-[2rem] border border-white bg-white/78 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,122,153,0.10)] p-5 xl:p-6 mb-5">
        <div className="flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-black rounded-full px-3 py-1 border border-slate-200 bg-white/90 text-slate-700 tracking-[0.18em]">
              PRODUCTION SCHEDULE
            </div>
            <h1 className="mt-3 text-3xl xl:text-[3.35rem] leading-none font-black text-slate-900">
              Production Schedule
            </h1>
            <p className="mt-3 text-slate-600 text-base xl:text-[17px] leading-relaxed max-w-2xl">
              Manage in-production orders by factory or assign real production dates on a calendar.
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              Use <strong>Priority</strong> for queue order and <strong>Production Date</strong> for the actual planned build slot.
            </p>
            {error && <p className="mt-3 text-sm text-rose-700">⚠️ {error}</p>}
          </div>

          <div className="w-full 2xl:w-auto space-y-3">
            <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
              <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setDisplayMode('BOARD')}
                  className={[
                    'h-9 px-4 rounded-xl text-[13px] font-bold transition',
                    displayMode === 'BOARD' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Layers3 size={15} className="inline mr-2" /> Board
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('CALENDAR')}
                  className={[
                    'h-9 px-4 rounded-xl text-[13px] font-bold transition',
                    displayMode === 'CALENDAR' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <CalendarDays size={15} className="inline mr-2" /> Calendar
                </button>
              </div>

              {displayMode === 'CALENDAR' && (
                <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setCalendarMode('WEEK')}
                    className={[
                      'h-9 px-4 rounded-xl text-[13px] font-bold transition',
                      calendarMode === 'WEEK' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarMode('MONTH')}
                    className={[
                      'h-9 px-4 rounded-xl text-[13px] font-bold transition',
                      calendarMode === 'MONTH' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    Month
                  </button>
                </div>
              )}

              <button
                onClick={async () => {
                  setRefreshing(true)
                  await load()
                  setRefreshing(false)
                }}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-900 font-semibold"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} /> Refresh
              </button>

              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white text-[13px] text-slate-900 font-semibold cursor-pointer">
                <input type="checkbox" className="accent-sky-600" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
                Auto
              </label>

              {displayMode === 'BOARD' && (
                <label className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white text-[13px] text-slate-900 font-semibold cursor-pointer">
                  <input type="checkbox" className="accent-sky-600" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
                  Compact
                </label>
              )}

              <button
                onClick={toggleFS}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-900 font-semibold"
                title={fs ? 'Exit full screen' : 'Full screen'}
              >
                {fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {fs ? 'Exit' : 'Full screen'}
              </button>
            </div>

            <div className="max-w-xl ml-auto">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by dealer, model, factory, address or date"
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-sm"
                />
              </div>
            </div>

            {displayMode === 'CALENDAR' && (
              <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
                <button onClick={() => navigatePeriod(-1)} className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-900"><ChevronLeft size={16} /> Prev</button>
                <button onClick={() => setFocusedDate(cloneUTC(new Date()))} className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-900"><CalendarDays size={16} /> Today</button>
                <button onClick={() => navigatePeriod(1)} className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-900">Next <ChevronRight size={16} /></button>
                <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 shadow-sm">
                  {calendarMode === 'WEEK' ? 'Week' : 'Month'}: {periodLabel(calendarMode, focusedDate)}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <span className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm">
            Total Queue: {stats.total}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[12px] font-semibold text-indigo-700 shadow-sm">
            Prioritized: {stats.prioritized}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 shadow-sm">
            Missing Priority: {stats.noPriority}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-semibold text-sky-700 shadow-sm">
            Production Dates Set: {stats.scheduled}
          </span>
        </div>
      </div>

      {displayMode === 'BOARD' ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
          {factories.map((factoryName) => {
            const list = byFactory[factoryName] || []
            return (
              <section key={factoryName} className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden">
                <header className="px-5 py-4 bg-white/70 border-b border-white/70 sticky top-0 z-10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-extrabold text-slate-900 truncate">{factoryName}</div>
                      <div className="text-xs text-slate-600">Priority → Production date → Requested ship → Created</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => normalizeFactoryPriorities(factoryName)}
                        className="text-[11px] font-bold px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        Normalize
                      </button>
                      <span className="text-xs font-black px-2 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">{list.length}</span>
                    </div>
                  </div>
                </header>

                <div className={`p-4 max-h-[72vh] overflow-y-auto ${compact ? 'space-y-2' : 'space-y-3'}`}>
                  {loading && (
                    <div className="space-y-3">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className={`rounded-3xl bg-white border border-slate-200 animate-pulse ${compact ? 'h-20' : 'h-24'}`} />
                      ))}
                    </div>
                  )}

                  {!loading && list.length === 0 && <div className="text-center text-slate-500 text-sm py-10">No orders</div>}

                  {!loading && list.map((o) => (
                    <BoardCard
                      key={o.id}
                      order={o}
                      compact={compact}
                      onOpen={openModal}
                      onDragStart={() => onBoardDragStart(o.id, factoryName)}
                      onDrop={() => onBoardDrop(o.id, factoryName)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-5 2xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <CalendarRailCard title="Unscheduled" subtitle="Ready to slot into production" count={calendarGroups[UNSCHEDULED_KEY]?.length || 0} tone="amber" onDragOver={(e) => e.preventDefault()} onDrop={onDropToUnscheduled}>
              <CalendarOrderList
                orders={calendarGroups[UNSCHEDULED_KEY] || []}
                loading={loading}
                draggingId={draggingCalendarId}
                busy={busy}
                onDragStart={setDraggingCalendarId}
                onOpen={openModal}
              />
            </CalendarRailCard>

            <CalendarRailCard title={calendarMode === 'WEEK' ? 'Outside Current Week' : 'Outside Current Month'} subtitle="Already scheduled, but outside the period" count={calendarGroups[OUTSIDE_PERIOD_KEY]?.length || 0} tone="sky">
              <CalendarOrderList
                orders={calendarGroups[OUTSIDE_PERIOD_KEY] || []}
                loading={loading}
                draggingId={draggingCalendarId}
                busy={busy}
                onDragStart={setDraggingCalendarId}
                onOpen={openModal}
              />
            </CalendarRailCard>
          </aside>

          <section className="rounded-3xl border border-white bg-white/82 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden">
            {calendarMode === 'WEEK' ? (
              <div className="grid grid-cols-7 min-h-[72vh]">
                {weekDays.map((day) => {
                  const key = dayKeyUTC(day)
                  const list = calendarGroups[key] || []
                  return (
                    <CalendarDayColumn
                      key={key}
                      title={day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                      count={list.length}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropToProductionDate(key)}
                    >
                      <CalendarOrderList
                        orders={list}
                        loading={loading}
                        draggingId={draggingCalendarId}
                        busy={busy}
                        onDragStart={setDraggingCalendarId}
                        onOpen={openModal}
                      />
                    </CalendarDayColumn>
                  )
                })}
              </div>
            ) : (
              <div className="min-h-[72vh]">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
                  {DAY_LABELS.map((label) => (
                    <div key={label} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[190px]">
                  {monthCells.map((day) => {
                    const key = dayKeyUTC(day)
                    const isCurrentMonth = `${day.getUTCFullYear()}-${day.getUTCMonth()}` === monthAnchorKey
                    const list = calendarGroups[key] || []
                    return (
                      <CalendarMonthCell
                        key={key}
                        day={day}
                        orders={list}
                        isCurrentMonth={isCurrentMonth}
                        loading={loading}
                        draggingId={draggingCalendarId}
                        busy={busy}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDropToProductionDate(key)}
                        onDragStart={setDraggingCalendarId}
                        onOpen={openModal}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {open && active && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div ref={modalRef} className="w-full max-w-2xl rounded-3xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.20)] overflow-hidden">
            <header className="px-6 py-5 border-b bg-white/80">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-wider text-slate-500">PRODUCTION ORDER</div>
                  <div className="text-2xl font-black text-slate-900 truncate">
                    {active.poolModel?.name || 'Order'} • {active.color?.name || '-'}
                  </div>
                  <div className="text-slate-600 truncate">
                    {active.dealer?.name || 'Dealer'} • {resolveFactoryName(active)}
                  </div>
                </div>
                <button onClick={closeModal} className="rounded-2xl p-3 hover:bg-slate-100 border border-transparent hover:border-slate-200" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="p-6 grid sm:grid-cols-2 gap-5 bg-slate-50/60">
              <Field label="Status">{statusPill(active.status)}</Field>
              <Field label="Created">{fmtDateTime(active.createdAt || null)}</Field>
              <Field label="Factory">{resolveFactoryName(active)}</Field>
              <Field label="Requested Ship Date">{fmtDate(active.requestedShipDate || null)}</Field>
              <Field label="Scheduled Production Date">{fmtDate(active.scheduledProductionDate || null)}</Field>
              <Field label="Delivery address" wrap>{active.deliveryAddress || '—'}</Field>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-extrabold text-slate-900 mb-3">Production Scheduling</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Priority (1 = first)</label>
                    <input type="number" min={1} max={9999} defaultValue={active.productionPriority ?? ''} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3" id="priorityInput" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Requested ship date</label>
                    <input type="date" defaultValue={active.requestedShipDate ? new Date(active.requestedShipDate).toISOString().slice(0, 10) : ''} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3" id="shipDateInput" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Scheduled production date</label>
                    <input type="date" defaultValue={active.scheduledProductionDate ? new Date(active.scheduledProductionDate).toISOString().slice(0, 10) : ''} className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3" id="productionDateInput" />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">Tip: drag cards within a factory to reprioritize, or drag to a calendar day to assign a production date.</div>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      const pEl = document.getElementById('priorityInput') as HTMLInputElement | null
                      const sEl = document.getElementById('shipDateInput') as HTMLInputElement | null
                      const prodEl = document.getElementById('productionDateInput') as HTMLInputElement | null
                      const pRaw = pEl?.value ?? ''
                      const sRaw = sEl?.value ?? ''
                      const prodRaw = prodEl?.value ?? ''

                      const p = pRaw === '' ? null : Number(pRaw)
                      const ship = sRaw === '' ? null : new Date(`${sRaw}T00:00:00.000Z`).toISOString()
                      const productionDate = prodRaw === '' ? null : new Date(`${prodRaw}T12:00:00.000Z`).toISOString()

                      await saveSchedule(active.id, p, ship, productionDate)
                    }}
                    className="inline-flex items-center justify-center h-10 px-4 rounded-2xl bg-slate-900 text-white font-extrabold hover:bg-slate-800 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <Link href={`/admin/orders/${active.id}/history`} className="text-blue-700 hover:underline inline-flex items-center gap-1">
                  <ExternalLink size={16} /> Open order history
                </Link>
                <Link href={`/admin/orders/${active.id}/media`} className="text-blue-700 hover:underline inline-flex items-center gap-1">
                  <ExternalLink size={16} /> Open files
                </Link>
                {active.paymentProofUrl && (
                  <a href={active.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline inline-flex items-center gap-1">
                    <Eye size={16} /> Deposit proof
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 1.2s linear infinite;
        }
      `}</style>
    </div>
  )
}

function BoardCard({
  order,
  compact,
  onOpen,
  onDragStart,
  onDrop,
}: {
  order: Order
  compact: boolean
  onOpen: (order: Order) => void
  onDragStart: () => void
  onDrop: () => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={[
        'group rounded-3xl border border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]',
        'hover:shadow-[0_16px_40px_rgba(2,132,199,0.10)] transition',
        compact ? 'p-3' : 'p-4',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => onOpen(order)} className="text-left min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-extrabold text-slate-900 truncate">
                {order.poolModel?.name || 'Model'} <span className="text-slate-400">•</span> {order.color?.name || '-'}
              </div>
              <div className="mt-0.5 text-[13px] text-slate-600 truncate">
                {order.dealer?.name || 'Dealer'} <span className="text-slate-400">•</span> {order.deliveryAddress || '—'}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">{statusPill(order.status)}</div>
          </div>

          <div className={`mt-3 flex flex-wrap gap-2 ${compact ? 'mt-2' : 'mt-3'}`}>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200">
              <Hash size={14} /> {typeof order.productionPriority === 'number' ? order.productionPriority : '—'}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200">
              <CalendarDays size={14} /> {fmtDate(order.scheduledProductionDate || null)}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200">
              <Calendar size={14} /> {fmtDate(order.requestedShipDate || null)}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200">
              <Clock size={14} /> {fmtDate(order.createdAt || null)}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl border border-slate-200 bg-white text-slate-500 cursor-grab active:cursor-grabbing">
            <GripVertical size={18} />
          </div>
        </div>
      </div>

      <div className={`mt-3 flex flex-wrap gap-3 text-[13px] ${compact ? 'mt-2' : 'mt-3'} opacity-0 group-hover:opacity-100 transition`}>
        <Link href={`/admin/orders/${order.id}/history`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
          <ExternalLink size={14} /> History
        </Link>
        <Link href={`/admin/orders/${order.id}/media`} className="inline-flex items-center gap-1 text-blue-700 hover:underline">
          <ExternalLink size={14} /> Files
        </Link>
        {order.paymentProofUrl && (
          <a href={order.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline">
            <Eye size={14} /> Deposit
          </a>
        )}
      </div>
    </div>
  )
}

function CalendarRailCard({
  title,
  subtitle,
  count,
  tone,
  children,
  onDragOver,
  onDrop,
}: {
  title: string
  subtitle: string
  count: number
  tone: 'amber' | 'sky'
  children: React.ReactNode
  onDragOver?: React.DragEventHandler<HTMLDivElement>
  onDrop?: React.DragEventHandler<HTMLDivElement> | (() => void)
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-sky-200 bg-sky-50 text-sky-900'

  return (
    <section className="rounded-3xl border border-white bg-white/82 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-200 bg-white/75">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">{title}</div>
            <div className="text-xs text-slate-600">{subtitle}</div>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-full border ${toneClasses}`}>{count}</span>
        </div>
      </header>
      <div className="p-4 max-h-[420px] overflow-y-auto" onDragOver={onDragOver} onDrop={onDrop as any}>
        {children}
      </div>
    </section>
  )
}

function CalendarDayColumn({
  title,
  count,
  children,
  onDragOver,
  onDrop,
}: {
  title: string
  count: number
  children: React.ReactNode
  onDragOver?: React.DragEventHandler<HTMLDivElement>
  onDrop?: React.DragEventHandler<HTMLDivElement> | (() => void)
}) {
  return (
    <div className="border-r border-slate-200 last:border-r-0 min-h-[72vh]">
      <div className="px-3 py-3 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-black text-slate-900 leading-tight">{title}</div>
          <span className="text-[10px] font-black px-2 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-900">{count}</span>
        </div>
      </div>
      <div className="p-2.5 h-[calc(72vh-57px)] overflow-y-auto" onDragOver={onDragOver} onDrop={onDrop as any}>
        {children}
      </div>
    </div>
  )
}

function CalendarMonthCell({
  day,
  orders,
  isCurrentMonth,
  loading,
  draggingId,
  busy,
  onDragOver,
  onDrop,
  onDragStart,
  onOpen,
}: {
  day: Date
  orders: Order[]
  isCurrentMonth: boolean
  loading: boolean
  draggingId: string | null
  busy: boolean
  onDragOver: React.DragEventHandler<HTMLDivElement>
  onDrop: () => void
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  return (
    <div
      className={['border-r border-b border-slate-200 p-2 overflow-hidden', isCurrentMonth ? 'bg-white' : 'bg-slate-50/70'].join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={['text-[13px] font-bold', isCurrentMonth ? 'text-slate-900' : 'text-slate-400'].join(' ')}>{day.getUTCDate()}</span>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">{orders.length}</span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-8 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      ) : orders.length === 0 ? null : (
        <div className="space-y-1.5 overflow-y-auto max-h-[132px] pr-1">
          {orders.map((order) => (
            <MiniCalendarOrderCard key={order.id} order={order} draggingId={draggingId} busy={busy} onDragStart={onDragStart} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  )
}

function CalendarOrderList({
  orders,
  loading,
  draggingId,
  busy,
  onDragStart,
  onOpen,
}: {
  orders: Order[]
  loading: boolean
  draggingId: string | null
  busy: boolean
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
        ))}
      </div>
    )
  }
  if (orders.length === 0) {
    return <div className="text-sm text-slate-500 py-8 text-center">No orders in this section.</div>
  }
  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <MiniCalendarOrderCard key={order.id} order={order} draggingId={draggingId} busy={busy} onDragStart={onDragStart} onOpen={onOpen} />
      ))}
    </div>
  )
}

function MiniCalendarOrderCard({
  order,
  draggingId,
  busy,
  onDragStart,
  onOpen,
}: {
  order: Order
  draggingId: string | null
  busy: boolean
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(order.id)}
      onClick={() => onOpen(order)}
      className={[
        'group rounded-2xl border border-slate-200/90 bg-white/96 px-3 py-2.5 shadow-sm cursor-pointer transition',
        'hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(2,132,199,0.12)]',
        draggingId === order.id ? 'opacity-60' : '',
        busy ? 'pointer-events-none' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-extrabold text-slate-900">{order.poolModel?.name || 'Order'}</div>
          <div className="truncate text-[11px] text-slate-600">{order.dealer?.name || 'Dealer'}</div>
        </div>
        <div className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical size={14} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          <Hash size={12} /> {typeof order.productionPriority === 'number' ? order.productionPriority : '—'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          <Calendar size={12} /> {fmtDate(order.requestedShipDate)}
        </span>
      </div>

      <div className="mt-2 text-[10px] text-slate-500 truncate">{resolveFactoryName(order)}</div>
    </div>
  )
}

function Field({
  label,
  children,
  wrap = false,
}: {
  label: string
  children: React.ReactNode
  wrap?: boolean
}) {
  return (
    <div className="text-[13px]">
      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`font-semibold text-slate-900 ${wrap ? '' : 'truncate'}`}>{children}</div>
    </div>
  )
}
