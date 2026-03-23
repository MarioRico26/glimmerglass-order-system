'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  MapPin,
  Printer,
  RefreshCw,
  Search,
  ShipWheel,
  Truck,
  X,
} from 'lucide-react'

type Maybe<T> = T | null | undefined

type OrderStatus = 'PRE_SHIPPING'
type ViewMode = 'WEEK' | 'MONTH'

interface Order {
  id: string
  deliveryAddress: string
  status: OrderStatus
  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factoryLocation: Maybe<{ name: string }>
  createdAt?: string
  requestedShipDate?: string | null
  scheduledShipDate?: string | null
  shippingMethod?: string | null
  serialNumber?: string | null
}

type ApiOrders = { items: Order[]; total?: number } | Order[]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const UNSCHEDULED_KEY = 'UNSCHEDULED'
const OUTSIDE_VIEW_KEY = 'OUTSIDE_VIEW'

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function shippingMethodLabel(value?: string | null) {
  if (value === 'PICK_UP') return 'Pick Up'
  if (value === 'QUOTE') return 'Glimmerglass Freight'
  return 'Not set'
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

function endOfMonthUTC(base = new Date()) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0))
}

function dayKeyUTC(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(+date)) return ''
  return date.toISOString().slice(0, 10)
}

function formatCompactDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(+d)) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatLongDate(value?: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(+d)) return '—'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function resolveFactoryName(order: Order) {
  return order.factoryLocation?.name || 'Unassigned Factory'
}

function compareOrders(a: Order, b: Order) {
  const aScheduled = a.scheduledShipDate ? +new Date(a.scheduledShipDate) : Number.MAX_SAFE_INTEGER
  const bScheduled = b.scheduledShipDate ? +new Date(b.scheduledShipDate) : Number.MAX_SAFE_INTEGER
  if (aScheduled !== bScheduled) return aScheduled - bScheduled

  const aRequested = a.requestedShipDate ? +new Date(a.requestedShipDate) : Number.MAX_SAFE_INTEGER
  const bRequested = b.requestedShipDate ? +new Date(b.requestedShipDate) : Number.MAX_SAFE_INTEGER
  if (aRequested !== bRequested) return aRequested - bRequested

  const aCreated = a.createdAt ? +new Date(a.createdAt) : Number.MAX_SAFE_INTEGER
  const bCreated = b.createdAt ? +new Date(b.createdAt) : Number.MAX_SAFE_INTEGER
  if (aCreated !== bCreated) return aCreated - bCreated

  return a.id.localeCompare(b.id)
}

function periodLabel(viewMode: ViewMode, focusedDate: Date) {
  if (viewMode === 'WEEK') {
    const start = startOfWeekUTC(focusedDate)
    const end = addDaysUTC(start, 6)
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
  }
  return focusedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function buildMonthCells(focusedDate: Date) {
  const monthStart = startOfMonthUTC(focusedDate)
  const gridStart = startOfWeekUTC(monthStart)
  return Array.from({ length: 42 }, (_, i) => addDaysUTC(gridStart, i))
}

export default function ShippingSchedulePage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('WEEK')
  const [focusedDate, setFocusedDate] = useState<Date>(() => cloneUTC(new Date()))
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [active, setActive] = useState<Order | null>(null)
  const [open, setOpen] = useState(false)
  const [unscheduledExpanded, setUnscheduledExpanded] = useState(true)
  const [outsideExpanded, setOutsideExpanded] = useState(false)
  const [unscheduledHeight, setUnscheduledHeight] = useState(380)
  const [outsideHeight, setOutsideHeight] = useState(320)
  const [railFilter, setRailFilter] = useState('')
  const [railWidth, setRailWidth] = useState(280)
  const [resizingRail, setResizingRail] = useState(false)
  const [resizingPanel, setResizingPanel] = useState<null | 'unscheduled' | 'outside'>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const panelResizeRef = useRef<{ startY: number; startHeight: number; panel: 'unscheduled' | 'outside' } | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '200',
        status: 'PRE_SHIPPING',
        sort: 'scheduledShipDate',
        dir: 'asc',
      })
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to load shipping queue'
        throw new Error(msg)
      }
      const data = await safeJson<ApiOrders>(res)
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
      setOrders(list.filter((o) => o.status === 'PRE_SHIPPING'))
    } catch (e: unknown) {
      setOrders([])
      setError(e instanceof Error ? e.message : 'Failed to load shipping queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(async () => {
      setRefreshing(true)
      await load()
      setRefreshing(false)
    }, 20000)
    return () => clearInterval(timer)
  }, [auto])

  useEffect(() => {
    if (!resizingRail) return

    const onMove = (e: MouseEvent) => {
      const next = Math.max(240, Math.min(460, e.clientX - 48))
      setRailWidth(next)
    }

    const onUp = () => setResizingRail(false)

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizingRail])

  useEffect(() => {
    if (!resizingPanel || !panelResizeRef.current) return

    const onMove = (e: MouseEvent) => {
      const context = panelResizeRef.current
      if (!context) return
      const delta = e.clientY - context.startY
      const next = Math.max(220, Math.min(760, context.startHeight + delta))
      if (context.panel === 'unscheduled') setUnscheduledHeight(next)
      else setOutsideHeight(next)
    }

    const onUp = () => {
      setResizingPanel(null)
      panelResizeRef.current = null
    }

    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizingPanel])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    const onClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) closeModal()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysUTC(startOfWeekUTC(focusedDate), i)), [focusedDate])
  const monthCells = useMemo(() => buildMonthCells(focusedDate), [focusedDate])
  const visibleDates = viewMode === 'WEEK' ? weekDays : monthCells
  const visibleKeys = useMemo(() => visibleDates.map((d) => dayKeyUTC(d)), [visibleDates])
  const monthAnchor = startOfMonthUTC(focusedDate)
  const monthAnchorKey = `${monthAnchor.getUTCFullYear()}-${monthAnchor.getUTCMonth()}`

  const filteredOrders = useMemo(() => {
    const q = railFilter.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((order) => {
      const haystack = [
        order.poolModel?.name,
        order.color?.name,
        order.dealer?.name,
        order.factoryLocation?.name,
        order.serialNumber,
        order.shippingMethod,
        order.deliveryAddress,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [orders, railFilter])

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {
      [UNSCHEDULED_KEY]: [],
      [OUTSIDE_VIEW_KEY]: [],
    }

    for (const key of visibleKeys) map[key] = []

    for (const order of filteredOrders) {
      const key = dayKeyUTC(order.scheduledShipDate)
      if (!key) {
        map[UNSCHEDULED_KEY].push(order)
        continue
      }
      if (visibleKeys.includes(key)) {
        map[key].push(order)
        continue
      }
      map[OUTSIDE_VIEW_KEY].push(order)
    }

    Object.keys(map).forEach((key) => map[key].sort(compareOrders))
    return map
  }, [filteredOrders, visibleKeys])

  const stats = useMemo(() => {
    const total = filteredOrders.length
    const unscheduled = grouped[UNSCHEDULED_KEY]?.length || 0
    const outsideView = grouped[OUTSIDE_VIEW_KEY]?.length || 0
    const scheduledInView = total - unscheduled - outsideView
    const overdueRequest = filteredOrders.filter((o) => {
      if (!o.requestedShipDate || o.scheduledShipDate) return false
      return +new Date(o.requestedShipDate) < +new Date()
    }).length
    return { total, unscheduled, outsideView, scheduledInView, overdueRequest }
  }, [filteredOrders, grouped])

  const saveScheduledShipDate = async (orderId: string, scheduledShipDate: string | null) => {
    setSavingId(orderId)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipping-schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledShipDate }),
      })
      const payload = await safeJson<Order | { message?: string }>(res)
      if (!res.ok) {
        throw new Error((payload as { message?: string } | null)?.message || 'Failed to save shipping schedule')
      }
      const updated = payload as Order
      setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, ...updated } : order)))
      setActive((prev) => (prev?.id === orderId ? { ...prev, ...updated } : prev))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Could not save shipping schedule')
      await load()
    } finally {
      setSavingId(null)
    }
  }

  const onDropToDate = async (dayKey: string) => {
    if (!draggingId) return
    const orderId = draggingId
    setDraggingId(null)
    setFocusedDate(cloneUTC(new Date(`${dayKey}T12:00:00.000Z`)))
    await saveScheduledShipDate(orderId, `${dayKey}T12:00:00.000Z`)
  }

  const onDropToUnscheduled = async () => {
    if (!draggingId) return
    const orderId = draggingId
    setDraggingId(null)
    await saveScheduledShipDate(orderId, null)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
  }

  const navigatePeriod = (direction: -1 | 1) => {
    setFocusedDate((prev) =>
      viewMode === 'WEEK' ? addDaysUTC(prev, direction * 7) : addMonthsUTC(prev, direction)
    )
  }

  const monthHeaders = DAY_LABELS
  const outsidePeriodTitle = viewMode === 'WEEK' ? 'Outside Current Week' : 'Outside Current Month'
  const outsidePeriodSubtitle =
    viewMode === 'WEEK'
      ? 'Already scheduled, but not inside this week'
      : 'Already scheduled, but not inside this month'
  const generatedAt = new Date().toLocaleString()

  return (
    <div
      data-ship-print-root
      className="min-h-screen p-4 xl:p-5 print:min-h-0 print:p-0"
      style={{
        background: `radial-gradient(1100px 700px at 85% 0%, #E6F7FA 0%, transparent 60%),
          radial-gradient(800px 500px at 8% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
          linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      <div data-ship-print-header className="hidden print:block mb-4 border-b border-slate-300 pb-4">
        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Glimmerglass Shipping Calendar</div>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Ship Schedule</h1>
        <div className="mt-2 text-sm text-slate-700">
          {viewMode === 'WEEK' ? 'Week' : 'Month'}: {periodLabel(viewMode, focusedDate)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Generated: {generatedAt}
          {railFilter.trim() ? ` • Filter: ${railFilter.trim()}` : ''}
        </div>
      </div>

      <div data-ship-screen className="rounded-[2rem] border border-white bg-white/78 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,122,153,0.10)] p-5 xl:p-6 mb-5 print:hidden">
        <div className="flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-black rounded-full px-3 py-1 border border-slate-200 bg-white/90 text-slate-700 tracking-[0.18em]">
              SHIPPING CALENDAR
            </div>
            <h1 className="mt-3 text-3xl xl:text-[3.35rem] leading-none font-black text-slate-900">Ship Schedule</h1>
            <p className="mt-3 text-slate-600 text-base xl:text-[17px] leading-relaxed max-w-2xl">
              Schedule real ship dates for pre-shipping orders. Drag an order onto a calendar day or open it to set the shipping date manually.
            </p>
            <p className="mt-1 text-[13px] text-slate-500">
              Requested ship date stays separate from logistics scheduling.
            </p>
            {error && <p className="mt-3 text-sm text-rose-700">⚠️ {error}</p>}
          </div>

          <div className="w-full 2xl:w-auto space-y-3">
            <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
              <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('WEEK')}
                  className={[
                    'h-9 px-4 rounded-xl text-[13px] font-bold transition',
                    viewMode === 'WEEK' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('MONTH')}
                  className={[
                    'h-9 px-4 rounded-xl text-[13px] font-bold transition',
                    viewMode === 'MONTH' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Month
                </button>
              </div>

              <button
                onClick={() => navigatePeriod(-1)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-900 font-semibold"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                onClick={() => setFocusedDate(cloneUTC(new Date()))}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-900 font-semibold"
              >
                <CalendarDays size={16} /> Today
              </button>
              <button
                onClick={() => navigatePeriod(1)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-900 font-semibold"
              >
                Next <ChevronRight size={16} />
              </button>
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
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-[13px] text-slate-900 font-semibold"
              >
                <Printer size={16} /> Print
              </button>
              <label className="inline-flex items-center gap-2 h-9 px-4 rounded-2xl border border-slate-200 bg-white text-[13px] text-slate-900 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-sky-600"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />
                Auto
              </label>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-700 shadow-sm">
              {viewMode === 'WEEK' ? 'Week' : 'Month'}: {periodLabel(viewMode, focusedDate)}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <span className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 shadow-sm">
            Queue: {stats.total}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700 shadow-sm">
            In View: {stats.scheduledInView}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-700 shadow-sm">
            Unscheduled: {stats.unscheduled}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-semibold text-sky-700 shadow-sm">
            Outside Period: {stats.outsideView}
          </span>
          <span className="inline-flex items-center rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700 shadow-sm">
            Overdue Request: {stats.overdueRequest}
          </span>
        </div>
        <div className="mt-4 max-w-xl">
          <label className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 mb-2">
            Quick Filter
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={railFilter}
              onChange={(e) => setRailFilter(e.target.value)}
              placeholder="Filter by dealer, model, serial, factory or address"
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-slate-800 shadow-sm"
            />
          </div>
        </div>
      </div>

      {!loading && orders.length === 0 ? (
        <section className="rounded-3xl border border-white bg-white/82 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] p-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                How It Works
              </div>
              <h2 className="mt-3 text-2xl font-black text-slate-900">
                No orders are ready for shipping yet
              </h2>
              <p className="mt-2 text-slate-600 leading-relaxed">
                This calendar only shows orders in <strong>Pre-Shipping</strong>. Once an order reaches that stage, operations can assign the real ship date here by dragging it from <strong>Unscheduled</strong> into a day on the calendar.
              </p>
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Use this board for the real logistics date. Keep <strong>Requested Ship Date</strong> as the dealer request and <strong>Scheduled Ship Date</strong> as the operations commitment.
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 1</div>
                <div className="mt-2 text-lg font-black text-slate-900">Move order to Pre-Shipping</div>
                <p className="mt-2 text-sm text-slate-600">
                  Orders only appear here after operations advances them out of production.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 2</div>
                <div className="mt-2 text-lg font-black text-slate-900">Assign a ship date</div>
                <p className="mt-2 text-sm text-slate-600">
                  Drag the order onto a calendar day or open the order card and save the date manually.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Step 3</div>
                <div className="mt-2 text-lg font-black text-slate-900">Review dispatch readiness</div>
                <p className="mt-2 text-sm text-slate-600">
                  Use serial number, shipping method and requested date to finalize the outbound schedule.
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : (
      <div
        data-ship-screen
        className="grid gap-5 xl:grid-cols-1 2xl:[grid-template-columns:minmax(240px,var(--ship-rail-width))_12px_minmax(0,1fr)] print:hidden"
        style={{ ['--ship-rail-width' as string]: `${railWidth}px` }}
      >
        <aside className="space-y-5">
          <RailCard
            title="Unscheduled"
            subtitle="Ready to assign"
            count={grouped[UNSCHEDULED_KEY]?.length || 0}
            tone="amber"
            expanded={unscheduledExpanded}
            onToggle={() => setUnscheduledExpanded((v) => !v)}
            height={unscheduledHeight}
            onResizeStart={(startY, startHeight) => {
              panelResizeRef.current = { startY, startHeight, panel: 'unscheduled' }
              setResizingPanel('unscheduled')
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropToUnscheduled}
          >
            <CompactOrderList
              orders={grouped[UNSCHEDULED_KEY] || []}
              loading={loading}
              draggingId={draggingId}
              savingId={savingId}
              onDragStart={setDraggingId}
              onOpen={(order) => {
                setActive(order)
                setOpen(true)
              }}
            />
          </RailCard>

          <RailCard
            title={outsidePeriodTitle}
            subtitle={outsidePeriodSubtitle}
            count={grouped[OUTSIDE_VIEW_KEY]?.length || 0}
            tone="sky"
            expanded={outsideExpanded}
            onToggle={() => setOutsideExpanded((v) => !v)}
            height={outsideHeight}
            onResizeStart={(startY, startHeight) => {
              panelResizeRef.current = { startY, startHeight, panel: 'outside' }
              setResizingPanel('outside')
            }}
          >
            <CompactOrderList
              orders={grouped[OUTSIDE_VIEW_KEY] || []}
              loading={loading}
              draggingId={draggingId}
              savingId={savingId}
              onDragStart={setDraggingId}
              onOpen={(order) => {
                setActive(order)
                setOpen(true)
              }}
            />
          </RailCard>
        </aside>

        <div className="hidden 2xl:flex items-stretch justify-center print:hidden">
          <button
            type="button"
            onMouseDown={() => setResizingRail(true)}
            className={[
              'group relative h-full w-3 rounded-full border border-slate-200/80 bg-white/70 backdrop-blur-sm',
              'shadow-[0_10px_24px_rgba(13,47,69,0.08)] transition hover:bg-white',
              resizingRail ? 'ring-2 ring-sky-200 bg-white' : '',
            ].join(' ')}
            aria-label="Resize shipping side panel"
            title="Drag to resize side panel"
          >
            <span className="absolute inset-y-6 left-1/2 -translate-x-1/2 w-1 rounded-full bg-slate-300 group-hover:bg-sky-400" />
          </button>
        </div>

        <section className="rounded-3xl border border-white bg-white/82 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden print:shadow-none print:border-slate-300 print:bg-white">
          {viewMode === 'WEEK' ? (
            <div className="grid grid-cols-7 min-h-[72vh]">
              {weekDays.map((day) => {
                const key = dayKeyUTC(day)
                const list = grouped[key] || []
                return (
                  <DayColumn
                    key={key}
                    title={day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    count={list.length}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDropToDate(key)}
                  >
                    <CompactOrderList
                      orders={list}
                      loading={loading}
                      draggingId={draggingId}
                      savingId={savingId}
                      onDragStart={setDraggingId}
                      onOpen={(order) => {
                        setActive(order)
                        setOpen(true)
                      }}
                    />
                  </DayColumn>
                )
              })}
            </div>
          ) : (
            <div className="min-h-[72vh]">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
                {monthHeaders.map((label) => (
                  <div key={label} className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 auto-rows-[180px]">
                {monthCells.map((day) => {
                  const key = dayKeyUTC(day)
                  const isCurrentMonth = `${day.getUTCFullYear()}-${day.getUTCMonth()}` === monthAnchorKey
                  const list = grouped[key] || []
                  return (
                    <MonthCell
                      key={key}
                      day={day}
                      orders={list}
                      isCurrentMonth={isCurrentMonth}
                      loading={loading}
                      draggingId={draggingId}
                      savingId={savingId}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropToDate(key)}
                      onDragStart={setDraggingId}
                      onOpen={(order) => {
                        setActive(order)
                        setOpen(true)
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
      )}

      <section data-ship-print className="hidden print:block">
        {viewMode === 'WEEK' ? (
          <PrintWeekView
            days={weekDays}
            grouped={grouped}
          />
        ) : (
          <PrintMonthView
            monthHeaders={monthHeaders}
            monthCells={monthCells}
            grouped={grouped}
            monthAnchorKey={monthAnchorKey}
          />
        )}
      </section>

      {open && active && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="w-full max-w-2xl rounded-3xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.20)] overflow-hidden"
          >
            <header className="px-6 py-5 border-b bg-white/80">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-wider text-slate-500">SHIP ORDER</div>
                  <div className="text-2xl font-black text-slate-900 truncate">
                    {active.poolModel?.name || 'Order'} • {active.color?.name || '-'}
                  </div>
                  <div className="text-slate-600 truncate">
                    {active.dealer?.name || 'Dealer'} • {resolveFactoryName(active)}
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-2xl p-3 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="p-6 grid sm:grid-cols-2 gap-5 bg-slate-50/60">
              <Field label="Requested Ship Date">{formatLongDate(active.requestedShipDate)}</Field>
              <Field label="Scheduled Ship Date">{formatLongDate(active.scheduledShipDate)}</Field>
              <Field label="Shipping Method">{shippingMethodLabel(active.shippingMethod)}</Field>
              <Field label="Serial Number">{active.serialNumber || 'Not assigned'}</Field>
              <Field label="Factory">{resolveFactoryName(active)}</Field>
              <Field label="Delivery Address" wrap>{active.deliveryAddress || '—'}</Field>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-extrabold text-slate-900 mb-3">Shipping Assignment</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Scheduled ship date</label>
                    <input
                      type="date"
                      defaultValue={active.scheduledShipDate ? dayKeyUTC(active.scheduledShipDate) : ''}
                      className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3"
                      id="scheduledShipDateInput"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={async () => {
                        await saveScheduledShipDate(active.id, null)
                      }}
                      disabled={savingId === active.id}
                      className="h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-bold disabled:opacity-50"
                    >
                      Clear Schedule
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Tip: drag an order into any calendar day for faster dispatch planning.
                  </div>
                  <button
                    disabled={savingId === active.id}
                    onClick={async () => {
                      const input = document.getElementById('scheduledShipDateInput') as HTMLInputElement | null
                      const raw = input?.value?.trim() || ''
                      await saveScheduledShipDate(active.id, raw ? `${raw}T12:00:00.000Z` : null)
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
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 1.2s linear infinite;
        }

        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }

          html,
          body {
            background: #fff !important;
          }

          [data-ship-print-root] {
            background: #fff !important;
          }

          [data-ship-screen] {
            display: none !important;
          }

          [data-ship-print] {
            display: block !important;
          }

          [data-ship-print-header] {
            display: block !important;
          }

          body * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}

function RailCard({
  title,
  subtitle,
  count,
  tone,
  expanded,
  onToggle,
  height,
  onResizeStart,
  children,
  onDragOver,
  onDrop,
}: {
  title: string
  subtitle: string
  count: number
  tone: 'amber' | 'sky'
  expanded: boolean
  onToggle: () => void
  height: number
  onResizeStart: (startY: number, startHeight: number) => void
  children: React.ReactNode
  onDragOver?: React.DragEventHandler<HTMLDivElement>
  onDrop?: React.DragEventHandler<HTMLDivElement> | (() => void)
}) {
  const toneClasses = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-sky-200 bg-sky-50 text-sky-900'

  return (
    <section className="rounded-3xl border border-white bg-white/82 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden print:break-inside-avoid print:shadow-none print:border-slate-300 print:bg-white">
      <header className="px-5 py-4 border-b border-slate-200 bg-white/75">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">{title}</div>
            <div className="text-xs text-slate-600">{subtitle}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black px-2 py-1 rounded-full border ${toneClasses}`}>{count}</span>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 print:hidden"
              aria-expanded={expanded}
              aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
              title={expanded ? 'Collapse panel' : 'Expand panel'}
            >
              <ChevronDown size={16} className={expanded ? 'transition-transform' : '-rotate-90 transition-transform'} />
            </button>
          </div>
        </div>
      </header>
      {expanded ? (
        <>
          <div
            className="p-4 overflow-y-auto"
            style={{ height }}
            onDragOver={onDragOver}
            onDrop={onDrop as any}
          >
            {children}
          </div>
          <div className="border-t border-slate-100 bg-white/80 px-4 py-2 print:hidden">
            <button
              type="button"
              onMouseDown={(e) => onResizeStart(e.clientY, height)}
              className="group flex w-full cursor-ns-resize items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
              title="Drag to resize panel height"
            >
              <span className="h-1.5 w-8 rounded-full bg-slate-300 group-hover:bg-sky-400" />
              Resize
              <span className="h-1.5 w-8 rounded-full bg-slate-300 group-hover:bg-sky-400" />
            </button>
          </div>
        </>
      ) : (
        <div className="px-5 py-4 text-sm text-slate-500">Panel collapsed.</div>
      )}
    </section>
  )
}

function DayColumn({
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
    <div className="border-r border-slate-200 last:border-r-0 min-h-[72vh] print:min-h-0">
      <div className="px-3 py-3 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10 print:static print:bg-white">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[13px] font-black text-slate-900 leading-tight">{title}</div>
          <span className="text-[10px] font-black px-2 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-900">{count}</span>
        </div>
      </div>
      <div className="p-2.5 h-[calc(72vh-57px)] overflow-y-auto print:h-auto print:overflow-visible" onDragOver={onDragOver} onDrop={onDrop as any}>
        {children}
      </div>
    </div>
  )
}

function MonthCell({
  day,
  orders,
  isCurrentMonth,
  loading,
  draggingId,
  savingId,
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
  savingId: string | null
  onDragOver: React.DragEventHandler<HTMLDivElement>
  onDrop: () => void
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  return (
    <div
      className={[
        'border-r border-b border-slate-200 p-2 overflow-hidden print:break-inside-avoid',
        isCurrentMonth ? 'bg-white' : 'bg-slate-50/70',
      ].join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={['text-[13px] font-bold', isCurrentMonth ? 'text-slate-900' : 'text-slate-400'].join(' ')}>
          {day.getUTCDate()}
        </span>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
          {orders.length}
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="h-8 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-8 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      ) : orders.length === 0 ? null : (
        <div className="space-y-1.5 overflow-y-auto max-h-[128px] pr-1 print:max-h-none print:overflow-visible">
          {orders.map((order) => (
            <MiniOrderCard
              key={order.id}
              order={order}
              variant="dense"
              draggingId={draggingId}
              savingId={savingId}
              onDragStart={onDragStart}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CompactOrderList({
  orders,
  loading,
  draggingId,
  savingId,
  onDragStart,
  onOpen,
  variant = 'full',
}: {
  orders: Order[]
  loading: boolean
  draggingId: string | null
  savingId: string | null
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
  variant?: 'full' | 'dense'
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
        <MiniOrderCard
          key={order.id}
          order={order}
          variant={variant}
          draggingId={draggingId}
          savingId={savingId}
          onDragStart={onDragStart}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}

function MiniOrderCard({
  order,
  variant = 'full',
  draggingId,
  savingId,
  onDragStart,
  onOpen,
}: {
  order: Order
  variant?: 'full' | 'dense'
  draggingId: string | null
  savingId: string | null
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  const dense = variant === 'dense'
  return (
    <div
      draggable
      onDragStart={() => onDragStart(order.id)}
      onClick={() => onOpen(order)}
      className={[
        'group cursor-pointer overflow-hidden border border-slate-200/90 bg-white/98 transition print:break-inside-avoid print:shadow-none print:border-slate-300',
        dense
          ? 'rounded-[1.1rem] px-2.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:shadow-[0_12px_22px_rgba(2,132,199,0.10)]'
          : 'rounded-[1.25rem] px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.07)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(2,132,199,0.12)]',
        draggingId === order.id ? 'opacity-60' : '',
        savingId === order.id ? 'ring-2 ring-sky-200' : '',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 max-w-full items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-sky-800">
          <span className="truncate">{resolveFactoryName(order)}</span>
        </span>
        <div className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm transition group-hover:border-sky-200 group-hover:text-sky-700">
          <GripVertical size={dense ? 12 : 14} />
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={dense ? 'truncate text-[12px] font-extrabold text-slate-900' : 'truncate text-[13px] font-extrabold text-slate-900'}>
            {order.poolModel?.name || 'Order'}
          </div>
          <div className={dense ? 'mt-0.5 truncate text-[10px] font-medium text-slate-600' : 'mt-0.5 truncate text-[11px] font-medium text-slate-600'}>
            {order.dealer?.name || 'Dealer'}
          </div>
        </div>
      </div>

      <div className={dense ? 'mt-2 flex flex-wrap gap-1.5 text-[9px]' : 'mt-2.5 flex flex-wrap gap-1.5 text-[10px]'}>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          <ShipWheel size={dense ? 10 : 12} /> {shippingMethodLabel(order.shippingMethod)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          <Truck size={dense ? 10 : 12} /> Req {formatCompactDate(order.requestedShipDate)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          SN {order.serialNumber || 'Pending'}
        </span>
      </div>

      {!dense && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-500">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{order.deliveryAddress || 'No delivery address'}</span>
        </div>
      )}
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

function PrintOrderLine({ order }: { order: Order }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white px-2 py-1.5">
      <div className="text-[10px] font-bold text-slate-900">
        {order.poolModel?.name || 'Order'}{order.color?.name ? ` • ${order.color.name}` : ''}
      </div>
      <div className="text-[9px] text-slate-700">
        {order.dealer?.name || 'Dealer'} • {resolveFactoryName(order)}
      </div>
      <div className="text-[9px] text-slate-600">
        {shippingMethodLabel(order.shippingMethod)} • Req {formatCompactDate(order.requestedShipDate)} • {order.serialNumber || 'No serial'}
      </div>
    </div>
  )
}

function PrintWeekView({
  days,
  grouped,
}: {
  days: Date[]
  grouped: Record<string, Order[]>
}) {
  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const key = dayKeyUTC(day)
          const list = grouped[key] || []
          return (
            <div key={key} className="rounded-xl border border-slate-300 bg-white p-2 align-top">
              <div className="border-b border-slate-200 pb-1">
                <div className="text-[11px] font-black text-slate-900">
                  {day.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </div>
                <div className="text-[9px] text-slate-500">{list.length} scheduled</div>
              </div>
              <div className="mt-2 min-h-[34px] space-y-1">
                {list.length ? list.map((order) => <PrintOrderLine key={order.id} order={order} />) : <div className="text-[9px] text-slate-400">No orders</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PrintMonthView({
  monthHeaders,
  monthCells,
  grouped,
  monthAnchorKey,
}: {
  monthHeaders: string[]
  monthCells: Date[]
  grouped: Record<string, Order[]>
  monthAnchorKey: string
}) {
  return (
    <div>
      <div className="grid grid-cols-7 border border-slate-300">
        {monthHeaders.map((label) => (
          <div key={label} className="border-b border-r border-slate-300 bg-slate-50 px-2 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
            {label}
          </div>
        ))}
        {monthCells.map((day) => {
          const key = dayKeyUTC(day)
          const list = grouped[key] || []
          const isCurrentMonth = `${day.getUTCFullYear()}-${day.getUTCMonth()}` === monthAnchorKey
          return (
            <div key={key} className={`min-h-[110px] border-r border-b border-slate-300 px-2 py-1.5 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/70'}`}>
              <div className={`text-[10px] font-black ${isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>{day.getUTCDate()}</div>
              <div className="mt-1 space-y-1">
                {list.slice(0, 4).map((order) => (
                  <div key={order.id} className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[9px] leading-tight">
                    <div className="font-bold text-slate-900 truncate">{order.poolModel?.name || 'Order'}</div>
                    <div className="truncate text-slate-600">{order.dealer?.name || 'Dealer'}</div>
                  </div>
                ))}
                {list.length > 4 ? <div className="text-[9px] text-slate-500">+{list.length - 4} more</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
