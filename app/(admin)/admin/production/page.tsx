// glimmerglass-order-system/app/(admin)/admin/production/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  PackageSearch,
  ExternalLink,
  Factory as FactoryIcon,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock,
} from 'lucide-react'

type Maybe<T> = T | null | undefined

type OrderStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

interface Order {
  id: string
  deliveryAddress: string
  status: OrderStatus | string
  paymentProofUrl?: string | null

  productionPriority?: number | null
  requestedShipDate?: string | null
  serialNumber?: string | null
  shippingMethod?: string | null

  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>

  // ✅ tu API devuelve factoryLocation (no factory)
  factoryLocation: Maybe<{ id?: string; name: string }>

  createdAt?: string
}

type ApiResp = {
  items: Order[]
  page: number
  pageSize: number
  total: number
}

const aqua = '#00B2CA'
const deep = '#007A99'

const MAX_PAGE_SIZE = 100

function cn(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(' ')
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

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const x = new Date(d)
  if (Number.isNaN(+x)) return '—'
  return x.toLocaleDateString()
}

function fmtDateTime(d?: string | null) {
  if (!d) return '—'
  const x = new Date(d)
  if (Number.isNaN(+x)) return '—'
  return x.toLocaleString()
}

function StatusPill({ status }: { status: string }) {
  const base = 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return <span className={cn(base, 'bg-amber-50 text-amber-800 border-amber-200')}>Pending</span>
    case 'IN_PRODUCTION':
      return <span className={cn(base, 'bg-indigo-50 text-indigo-800 border-indigo-200')}>In Production</span>
    case 'PRE_SHIPPING':
      return <span className={cn(base, 'bg-violet-50 text-violet-800 border-violet-200')}>Pre-Shipping</span>
    case 'COMPLETED':
      return <span className={cn(base, 'bg-emerald-50 text-emerald-800 border-emerald-200')}>Completed</span>
    case 'CANCELED':
      return <span className={cn(base, 'bg-rose-50 text-rose-800 border-rose-200')}>Canceled</span>
    default:
      return <span className={cn(base, 'bg-slate-50 text-slate-700 border-slate-200')}>{status.replaceAll('_', ' ')}</span>
  }
}

/** ---------- main ---------- */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [auto, setAuto] = useState(true)
  const [fs, setFs] = useState(false)

  const [showCompleted, setShowCompleted] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)

  // Modal state
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Order | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)

  const loadAllOrders = async () => {
    // ✅ paga la deuda técnica: no pedir pageSize > 100 y traer TODO
    const pageSize = MAX_PAGE_SIZE
    let page = 1
    let all: Order[] = []
    let keepGoing = true

    while (keepGoing) {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      params.set('sort', 'createdAt')
      params.set('dir', 'desc')

      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      const payload = await safeJson<any>(res)

      if (!res.ok) {
        throw new Error(payload?.message || `Failed to load orders (${res.status})`)
      }

      const data: ApiResp | null =
        payload && Array.isArray(payload?.items) ? (payload as ApiResp) : null

      const items = data?.items ?? []
      all = all.concat(items)

      if (items.length < pageSize) keepGoing = false
      else page += 1

      // safety valve
      if (page > 50) keepGoing = false
    }

    return all
  }

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const all = await loadAllOrders()
      setOrders(all)
    } catch (e: any) {
      console.error('Production Board load error:', e)
      setOrders([])
      setError(e?.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!auto) return
    const t = setInterval(async () => {
      try {
        setRefreshing(true)
        const all = await loadAllOrders()
        setOrders(all)
        setError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load orders')
      } finally {
        setRefreshing(false)
      }
    }, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
      // ignore
    }
  }

  /** Filters for the board (we schedule production, so defaults hide completed/canceled) */
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!showCompleted && o.status === 'COMPLETED') return false
      if (!showCanceled && o.status === 'CANCELED') return false
      return true
    })
  }, [orders, showCompleted, showCanceled])

  /** Group by factory */
  const byFactory = useMemo(() => {
    const map: Record<string, Order[]> = {}
    filteredOrders.forEach((o) => {
      const key = o.factoryLocation?.name || 'Unknown Factory'
      ;(map[key] ||= []).push(o)
    })

    // Sort inside each factory by: Priority -> Requested ship date -> Created
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const pa = typeof a.productionPriority === 'number' ? a.productionPriority : 999999
        const pb = typeof b.productionPriority === 'number' ? b.productionPriority : 999999
        if (pa !== pb) return pa - pb

        const sa = a.requestedShipDate ? +new Date(a.requestedShipDate) : 9999999999999
        const sb = b.requestedShipDate ? +new Date(b.requestedShipDate) : 9999999999999
        if (sa !== sb) return sa - sb

        const ca = a.createdAt ? +new Date(a.createdAt) : 0
        const cb = b.createdAt ? +new Date(b.createdAt) : 0
        return ca - cb
      })
    })

    return map
  }, [filteredOrders])

  const factories = useMemo(() => Object.keys(byFactory).sort(), [byFactory])

  /** Modal handlers */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(1100px 700px at 80% 0%, #E6F7FA 0%, transparent 60%),
          radial-gradient(800px 500px at 10% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
          linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6 space-y-5">
        {/* Header */}
        <div className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase rounded-full px-3 py-1 border border-slate-200 bg-white text-slate-700">
                <FactoryIcon size={14} />
                Production Board
              </div>

              <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
                Order of fabrication by factory
              </h1>

              <p className="text-slate-600 mt-1">
                Sorts by <span className="font-semibold">Priority</span> → <span className="font-semibold">Ship date</span> →{' '}
                <span className="font-semibold">Created</span>.
              </p>

              {error && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  <AlertTriangle size={16} />
                  <span className="font-semibold">Failed to load orders:</span> {error}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  setRefreshing(true)
                  try {
                    const all = await loadAllOrders()
                    setOrders(all)
                    setError(null)
                  } catch (e: any) {
                    setError(e?.message || 'Failed to load orders')
                  } finally {
                    setRefreshing(false)
                  }
                }}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
                title="Refresh"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
                Refresh
              </button>

              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-sky-600"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />
                Auto
              </label>

              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-sky-600"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                />
                Show completed
              </label>

              <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-sky-600"
                  checked={showCanceled}
                  onChange={(e) => setShowCanceled(e.target.checked)}
                />
                Show canceled
              </label>

              <button
                onClick={toggleFS}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
                title={fs ? 'Exit full screen' : 'Full screen'}
              >
                {fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {fs ? 'Exit' : 'Full screen'}
              </button>

              <div className="h-1 w-28 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }} />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4"
              >
                <div className="h-6 w-40 rounded bg-slate-200/70 animate-pulse" />
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="h-14 rounded-2xl bg-slate-200/50 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : factories.length === 0 ? (
          <div className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <PackageSearch size={26} className="text-slate-500" />
            </div>
            <div className="text-xl font-black text-slate-900">No orders</div>
            <div className="text-slate-600">Nothing to schedule. Lucky you.</div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            {factories.map((factoryName) => {
              const items = byFactory[factoryName] || []
              return (
                <section
                  key={factoryName}
                  className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] ring-1 ring-white/60 overflow-hidden flex flex-col"
                >
                  <header className="px-4 py-3 bg-slate-50/70 border-b border-white/70 sticky top-0 z-10">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-extrabold text-slate-900 truncate">{factoryName}</h2>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">
                        {items.length}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      Priority → Ship date → Created
                    </div>
                  </header>

                  <div className="p-3 space-y-2 max-h-[72vh] overflow-y-auto overscroll-contain">
                    {items.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => openModal(o)}
                        className="group w-full text-left rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                      >
                        <div className="p-3 flex items-start gap-3">
                          <div className="mt-1 h-9 w-1.5 rounded-full bg-slate-200 group-hover:bg-sky-300 transition shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-bold text-slate-900 truncate">
                                {o.poolModel?.name || 'Model'}{' '}
                                <span className="text-slate-400 font-extrabold">•</span>{' '}
                                <span className="text-slate-700">{o.color?.name || '-'}</span>
                              </div>
                              <StatusPill status={String(o.status)} />
                            </div>

                            <div className="mt-1 text-sm text-slate-600 truncate">
                              {o.dealer?.name || 'Dealer'} • {o.deliveryAddress || '—'}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                                <CheckCircle2 size={14} />
                                Priority: <span className="font-semibold text-slate-900">{typeof o.productionPriority === 'number' ? o.productionPriority : '—'}</span>
                              </span>

                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                                <Calendar size={14} />
                                Ship: <span className="font-semibold text-slate-900">{fmtDate(o.requestedShipDate)}</span>
                              </span>

                              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1">
                                <Clock size={14} />
                                Created: <span className="font-semibold text-slate-900">{fmtDate(o.createdAt)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {open && active && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="w-full max-w-2xl rounded-3xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,.15)] overflow-hidden"
          >
            <header className="px-5 py-4 border-b bg-white/80 sticky top-0 z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Order
                  </div>
                  <h3 className="font-black text-slate-900 truncate">
                    {active.poolModel?.name || 'Order'} • {active.color?.name || '-'}
                  </h3>
                  <p className="text-sm text-slate-600 truncate">
                    {active.dealer?.name || 'Dealer'} • {active.factoryLocation?.name || 'Factory'}
                  </p>
                </div>

                <button
                  onClick={closeModal}
                  className="rounded-2xl p-2 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <Field label="Order ID">{active.id}</Field>
              <Field label="Status">
                <StatusPill status={String(active.status)} />
              </Field>

              <Field label="Priority">{typeof active.productionPriority === 'number' ? active.productionPriority : '—'}</Field>
              <Field label="Requested ship date">{fmtDate(active.requestedShipDate)}</Field>

              <Field label="Created">{fmtDateTime(active.createdAt)}</Field>
              <Field label="Delivery address" wrap>
                {active.deliveryAddress || '—'}
              </Field>

              <Field label="Payment proof">
                {active.paymentProofUrl ? (
                  <a
                    href={active.paymentProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <ExternalLink size={16} /> View file
                  </a>
                ) : (
                  'Not uploaded'
                )}
              </Field>

              <Field label="Links">
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/admin/orders/${active.id}/history`}
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <ExternalLink size={16} /> Open order history
                  </Link>
                  <Link
                    href={`/admin/orders/${active.id}/media`}
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <ExternalLink size={16} /> Open files
                  </Link>
                </div>
              </Field>
            </div>

            <div className="px-5 pb-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
                Status buttons (Start/Pre-Ship/Complete/Cancel) los dejamos para después, como pediste. Acá la prioridad es el scheduling por fábrica.
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

/** ---------- UI bits ---------- */
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
      <div className={cn('font-medium text-slate-900', wrap ? '' : 'truncate')}>{children}</div>
    </div>
  )
}