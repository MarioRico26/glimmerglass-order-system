'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  MapPin,
  RefreshCw,
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
  const modalRef = useRef<HTMLDivElement | null>(null)

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

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {
      [UNSCHEDULED_KEY]: [],
      [OUTSIDE_VIEW_KEY]: [],
    }

    for (const key of visibleKeys) map[key] = []

    for (const order of orders) {
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
  }, [orders, visibleKeys])

  const stats = useMemo(() => {
    const total = orders.length
    const unscheduled = grouped[UNSCHEDULED_KEY]?.length || 0
    const outsideView = grouped[OUTSIDE_VIEW_KEY]?.length || 0
    const scheduledInView = total - unscheduled - outsideView
    const overdueRequest = orders.filter((o) => {
      if (!o.requestedShipDate || o.scheduledShipDate) return false
      return +new Date(o.requestedShipDate) < +new Date()
    }).length
    return { total, unscheduled, outsideView, scheduledInView, overdueRequest }
  }, [orders, grouped])

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

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: `radial-gradient(1100px 700px at 85% 0%, #E6F7FA 0%, transparent 60%),
          radial-gradient(800px 500px at 8% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
          linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      <div className="rounded-3xl border border-white bg-white/72 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6 mb-5">
        <div className="flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs font-black rounded-full px-3 py-1 border border-slate-200 bg-white/80 text-slate-700">
              SHIPPING CALENDAR
            </div>
            <h1 className="mt-3 text-3xl sm:text-5xl font-black text-slate-900">Ship Schedule</h1>
            <p className="mt-3 text-slate-600 text-lg leading-relaxed">
              Outlook-style shipping calendar for pre-shipping orders. Drag orders into a calendar day to assign the real ship date.
            </p>
            <p className="mt-1 text-sm text-slate-500">
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
                    'h-10 px-4 rounded-xl text-sm font-bold transition',
                    viewMode === 'WEEK' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('MONTH')}
                  className={[
                    'h-10 px-4 rounded-xl text-sm font-bold transition',
                    viewMode === 'MONTH' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  Month
                </button>
              </div>

              <button
                onClick={() => navigatePeriod(-1)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <button
                onClick={() => setFocusedDate(cloneUTC(new Date()))}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
              >
                <CalendarDays size={16} /> Today
              </button>
              <button
                onClick={() => navigatePeriod(1)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
              >
                Next <ChevronRight size={16} />
              </button>
              <button
                onClick={async () => {
                  setRefreshing(true)
                  await load()
                  setRefreshing(false)
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} /> Refresh
              </button>
              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-sky-600"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />
                Auto
              </label>
            </div>

            <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
              {viewMode === 'WEEK' ? 'Week' : 'Month'}: {periodLabel(viewMode, focusedDate)}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">
            Queue: {stats.total}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            In View: {stats.scheduledInView}
          </span>
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
            Unscheduled: {stats.unscheduled}
          </span>
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
            Outside View: {stats.outsideView}
          </span>
          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
            Overdue Request: {stats.overdueRequest}
          </span>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <RailCard
            title="Unscheduled"
            subtitle="Ready to assign"
            count={grouped[UNSCHEDULED_KEY]?.length || 0}
            tone="amber"
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
            title="Outside View"
            subtitle={viewMode === 'WEEK' ? 'Scheduled outside this week' : 'Scheduled outside this month'}
            count={grouped[OUTSIDE_VIEW_KEY]?.length || 0}
            tone="sky"
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

        <section className="rounded-3xl border border-white bg-white/82 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden">
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
      `}</style>
    </div>
  )
}

function RailCard({
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
  const toneClasses = tone === 'amber'
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
      <div className="p-4 max-h-[300px] overflow-y-auto" onDragOver={onDragOver} onDrop={onDrop as any}>
        {children}
      </div>
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
    <div className="border-r border-slate-200 last:border-r-0 min-h-[72vh]">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-black text-slate-900">{title}</div>
          <span className="text-[11px] font-black px-2 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-900">{count}</span>
        </div>
      </div>
      <div className="p-3 h-[calc(72vh-57px)] overflow-y-auto" onDragOver={onDragOver} onDrop={onDrop as any}>
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
        'border-r border-b border-slate-200 p-2 overflow-hidden',
        isCurrentMonth ? 'bg-white' : 'bg-slate-50/70',
      ].join(' ')}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={['text-sm font-bold', isCurrentMonth ? 'text-slate-900' : 'text-slate-400'].join(' ')}>
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
        <div className="space-y-2 overflow-y-auto max-h-[130px] pr-1">
          {orders.map((order) => (
            <MiniOrderCard
              key={order.id}
              order={order}
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
}: {
  orders: Order[]
  loading: boolean
  draggingId: string | null
  savingId: string | null
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
        <MiniOrderCard
          key={order.id}
          order={order}
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
  draggingId,
  savingId,
  onDragStart,
  onOpen,
}: {
  order: Order
  draggingId: string | null
  savingId: string | null
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(order.id)}
      onClick={() => onOpen(order)}
      className={[
        'group rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm cursor-pointer transition',
        'hover:shadow-[0_12px_30px_rgba(2,132,199,0.10)]',
        draggingId === order.id ? 'opacity-60' : '',
        savingId === order.id ? 'ring-2 ring-sky-200' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-extrabold text-slate-900">
            {order.poolModel?.name || 'Order'}
          </div>
          <div className="truncate text-[12px] text-slate-600">{order.dealer?.name || 'Dealer'}</div>
        </div>
        <div className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 cursor-grab active:cursor-grabbing shrink-0">
          <GripVertical size={14} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          <ShipWheel size={12} /> {shippingMethodLabel(order.shippingMethod)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
          <Truck size={12} /> {formatCompactDate(order.requestedShipDate)}
        </span>
      </div>

      <div className="mt-2 text-[11px] text-slate-500 truncate">{resolveFactoryName(order)} • {order.serialNumber || 'No serial'}</div>
      <div className="mt-1 text-[11px] text-slate-500 truncate inline-flex items-center gap-1">
        <MapPin size={11} /> {order.deliveryAddress || '—'}
      </div>
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
    <div className="text-sm">
      <div className="text-slate-500">{label}</div>
      <div className={`font-semibold text-slate-900 ${wrap ? '' : 'truncate'}`}>{children}</div>
    </div>
  )
}
