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
  PackageSearch,
  RefreshCw,
  ShipWheel,
  Truck,
  X,
} from 'lucide-react'

type Maybe<T> = T | null | undefined

type OrderStatus = 'PRE_SHIPPING'

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

const aqua = '#00B2CA'
const deep = '#007A99'
const OFF_WEEK_KEY = 'OFF_WEEK'
const UNSCHEDULED_KEY = 'UNSCHEDULED'

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

function startOfWeekUTC(base = new Date()) {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))
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

function dayKeyUTC(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(+date)) return ''
  return date.toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
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

function formatColumnTitle(value: Date) {
  return value.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function resolveFactoryName(order: Order) {
  return order.factoryLocation?.name || 'Unassigned Factory'
}

function compareOrders(a: Order, b: Order) {
  const aRequested = a.requestedShipDate ? +new Date(a.requestedShipDate) : Number.MAX_SAFE_INTEGER
  const bRequested = b.requestedShipDate ? +new Date(b.requestedShipDate) : Number.MAX_SAFE_INTEGER
  if (aRequested !== bRequested) return aRequested - bRequested

  const aCreated = a.createdAt ? +new Date(a.createdAt) : Number.MAX_SAFE_INTEGER
  const bCreated = b.createdAt ? +new Date(b.createdAt) : Number.MAX_SAFE_INTEGER
  if (aCreated !== bCreated) return aCreated - bCreated

  return a.id.localeCompare(b.id)
}

function weekRangeLabel(start: Date) {
  const end = addDaysUTC(start, 6)
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`
}

export default function ShippingSchedulePage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeekUTC(new Date()))
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
        pageSize: '300',
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
      if (e.key === 'Escape') {
        setOpen(false)
        setActive(null)
      }
    }
    const onClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActive(null)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysUTC(weekStart, i)), [weekStart])
  const dayKeys = useMemo(() => days.map((d) => dayKeyUTC(d)), [days])

  const columns = useMemo(() => {
    const map: Record<string, Order[]> = {
      [UNSCHEDULED_KEY]: [],
      [OFF_WEEK_KEY]: [],
    }
    dayKeys.forEach((key) => {
      map[key] = []
    })

    for (const order of orders) {
      const key = dayKeyUTC(order.scheduledShipDate)
      if (!key) {
        map[UNSCHEDULED_KEY].push(order)
      } else if (dayKeys.includes(key)) {
        map[key].push(order)
      } else {
        map[OFF_WEEK_KEY].push(order)
      }
    }

    Object.keys(map).forEach((key) => map[key].sort(compareOrders))
    return map
  }, [orders, dayKeys])

  const stats = useMemo(() => {
    const total = orders.length
    const unscheduled = columns[UNSCHEDULED_KEY]?.length || 0
    const outsideWeek = columns[OFF_WEEK_KEY]?.length || 0
    const scheduledThisWeek = total - unscheduled - outsideWeek
    const overdueRequest = orders.filter((o) => {
      if (!o.requestedShipDate || o.scheduledShipDate) return false
      return dayKeyUTC(o.requestedShipDate) < dayKeyUTC(new Date())
    }).length
    return { total, unscheduled, outsideWeek, scheduledThisWeek, overdueRequest }
  }, [orders, columns])

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

  const onDropColumn = async (columnKey: string) => {
    if (!draggingId) return
    const nextValue =
      columnKey === UNSCHEDULED_KEY
        ? null
        : columnKey === OFF_WEEK_KEY
          ? null
          : `${columnKey}T12:00:00.000Z`
    const orderId = draggingId
    setDraggingId(null)
    await saveScheduledShipDate(orderId, nextValue)
  }

  const openModal = (order: Order) => {
    setActive(order)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background: `radial-gradient(1100px 700px at 85% 0%, #E6F7FA 0%, transparent 60%),
          radial-gradient(800px 500px at 8% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
          linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6 mb-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black rounded-full px-3 py-1 border border-slate-200 bg-white/80 text-slate-700">
              SHIPPING BOARD
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900">Ship Schedule</h1>
            <p className="mt-2 text-slate-600">
              Pre-shipping orders scheduled by logistics week. Drag cards into a day to assign the real ship date.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Requested ship date stays separate from scheduled ship date.
            </p>
            {error && <p className="mt-2 text-sm text-rose-700">⚠️ {error}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWeekStart((prev) => addDaysUTC(prev, -7))}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
            >
              <ChevronLeft size={16} /> Prev Week
            </button>
            <button
              onClick={() => setWeekStart(startOfWeekUTC(new Date()))}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
            >
              <CalendarDays size={16} /> This Week
            </button>
            <button
              onClick={() => setWeekStart((prev) => addDaysUTC(prev, 7))}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
            >
              Next Week <ChevronRight size={16} />
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
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">
            Week: {weekRangeLabel(weekStart)}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700">
            Queue: {stats.total}
          </span>
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            Scheduled This Week: {stats.scheduledThisWeek}
          </span>
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
            Unscheduled: {stats.unscheduled}
          </span>
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700">
            Outside Week: {stats.outsideWeek}
          </span>
          <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
            Overdue Request: {stats.overdueRequest}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          <ShipColumn
            title="Unscheduled"
            subtitle="Ready to assign"
            count={columns[UNSCHEDULED_KEY]?.length || 0}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropColumn(UNSCHEDULED_KEY)}
            accent="amber"
          >
            <OrderCardList
              orders={columns[UNSCHEDULED_KEY] || []}
              loading={loading}
              savingId={savingId}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onOpen={openModal}
            />
          </ShipColumn>

          {days.map((day) => {
            const key = dayKeyUTC(day)
            return (
              <ShipColumn
                key={key}
                title={formatColumnTitle(day)}
                subtitle="Scheduled ship date"
                count={columns[key]?.length || 0}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropColumn(key)}
                accent="sky"
              >
                <OrderCardList
                  orders={columns[key] || []}
                  loading={loading}
                  savingId={savingId}
                  draggingId={draggingId}
                  onDragStart={setDraggingId}
                  onOpen={openModal}
                />
              </ShipColumn>
            )
          })}

          <ShipColumn
            title="Outside Week"
            subtitle="Scheduled elsewhere"
            count={columns[OFF_WEEK_KEY]?.length || 0}
            accent="slate"
          >
            <OrderCardList
              orders={columns[OFF_WEEK_KEY] || []}
              loading={loading}
              savingId={savingId}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onOpen={openModal}
            />
          </ShipColumn>
        </div>
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
                    Tip: drag cards into a day column for the fastest scheduling flow.
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

function ShipColumn({
  title,
  subtitle,
  count,
  accent,
  children,
  onDragOver,
  onDrop,
}: {
  title: string
  subtitle: string
  count: number
  accent: 'amber' | 'sky' | 'slate'
  children: React.ReactNode
  onDragOver?: React.DragEventHandler<HTMLDivElement>
  onDrop?: React.DragEventHandler<HTMLDivElement> | (() => void)
}) {
  const tone =
    accent === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : accent === 'sky'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <section className="w-[300px] rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden shrink-0">
      <header className="px-5 py-4 bg-white/75 border-b border-white/70 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-extrabold text-slate-900 truncate">{title}</div>
            <div className="text-xs text-slate-600">{subtitle}</div>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-full border ${tone}`}>
            {count}
          </span>
        </div>
      </header>
      <div className="p-4 min-h-[68vh] max-h-[68vh] overflow-y-auto" onDragOver={onDragOver} onDrop={onDrop as any}>
        {children}
      </div>
    </section>
  )
}

function OrderCardList({
  orders,
  loading,
  savingId,
  draggingId,
  onDragStart,
  onOpen,
}: {
  orders: Order[]
  loading: boolean
  savingId: string | null
  draggingId: string | null
  onDragStart: (id: string) => void
  onOpen: (order: Order) => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-3xl bg-slate-100 animate-pulse border border-slate-200" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-center text-slate-500 text-sm px-4">
        No orders in this column.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <button
          key={order.id}
          type="button"
          draggable
          onDragStart={() => onDragStart(order.id)}
          onClick={() => onOpen(order)}
          className={[
            'group w-full text-left rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition',
            'hover:shadow-[0_16px_40px_rgba(2,132,199,0.10)]',
            draggingId === order.id ? 'opacity-60' : '',
            savingId === order.id ? 'ring-2 ring-sky-200' : '',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900 truncate">
                {order.poolModel?.name || 'Model'} <span className="text-slate-400">•</span> {order.color?.name || '-'}
              </div>
              <div className="mt-1 text-[13px] text-slate-600 truncate">
                {order.dealer?.name || 'Dealer'}
              </div>
            </div>
            <div className="p-2 rounded-2xl border border-slate-200 bg-white text-slate-500 cursor-grab active:cursor-grabbing shrink-0">
              <GripVertical size={18} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200">
              <ShipWheel size={14} /> {shippingMethodLabel(order.shippingMethod)}
            </span>
            <span className="inline-flex items-center gap-1 text-[12px] font-bold px-2 py-1 rounded-full bg-slate-50 text-slate-800 border border-slate-200">
              <Truck size={14} /> {formatDate(order.requestedShipDate)}
            </span>
          </div>

          <div className="mt-3 grid gap-2 text-[12px] text-slate-600">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{order.deliveryAddress || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="truncate">{resolveFactoryName(order)}</span>
              <span className="font-mono text-slate-700 shrink-0">{order.serialNumber || 'No serial'}</span>
            </div>
          </div>
        </button>
      ))}
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
