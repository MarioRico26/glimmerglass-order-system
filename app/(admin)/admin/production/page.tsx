// glimmerglass-order-system/app/(admin)/admin/production/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  RefreshCw,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  Factory as FactoryIcon,
  PackageSearch,
  CalendarDays,
  Hash,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

type Maybe<T> = T | null | undefined

type FlowStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

interface Order {
  id: string
  deliveryAddress: string
  status: FlowStatus
  paymentProofUrl?: string | null

  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factoryLocation: Maybe<{ name: string }>

  createdAt?: string | null

  // para producción
  requestedShipDate?: string | null
  productionPriority?: number | null
  serialNumber?: string | null
}

type ApiResp = {
  items: Order[]
  page: number
  pageSize: number
  total: number
}

const STATUSES: FlowStatus[] = [
  'PENDING_PAYMENT_APPROVAL',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
  'CANCELED',
]

const STATUS_LABEL: Record<FlowStatus, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

const STATUS_STYLE: Record<
  FlowStatus,
  { head: string; bg: string; rail: string; text: string }
> = {
  PENDING_PAYMENT_APPROVAL: {
    head: 'bg-amber-100/70',
    bg: 'bg-amber-50',
    rail: 'bg-amber-300',
    text: 'text-amber-900',
  },
  IN_PRODUCTION: {
    head: 'bg-indigo-100/70',
    bg: 'bg-indigo-50',
    rail: 'bg-indigo-300',
    text: 'text-indigo-900',
  },
  PRE_SHIPPING: {
    head: 'bg-violet-100/70',
    bg: 'bg-violet-50',
    rail: 'bg-violet-300',
    text: 'text-violet-900',
  },
  COMPLETED: {
    head: 'bg-emerald-100/70',
    bg: 'bg-emerald-50',
    rail: 'bg-emerald-300',
    text: 'text-emerald-900',
  },
  CANCELED: {
    head: 'bg-rose-100/70',
    bg: 'bg-rose-50',
    rail: 'bg-rose-300',
    text: 'text-rose-900',
  },
}

const aqua = '#00B2CA'
const deep = '#007A99'

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

// trae TODAS las órdenes respetando tu API paginada
async function fetchAllOrders(): Promise<Order[]> {
  const pageSize = 200
  const first = await fetch(`/api/admin/orders?page=1&pageSize=${pageSize}`, { cache: 'no-store' })
  if (!first.ok) throw new Error('Failed to load orders')
  const firstData = await safeJson<ApiResp>(first)
  const items = firstData?.items ?? []
  const total = firstData?.total ?? items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (totalPages <= 1) return items

  const restPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  const rest = await Promise.all(
    restPages.map(async (p) => {
      const r = await fetch(`/api/admin/orders?page=${p}&pageSize=${pageSize}`, { cache: 'no-store' })
      if (!r.ok) return []
      const d = await safeJson<ApiResp>(r)
      return d?.items ?? []
    })
  )

  return items.concat(...rest)
}

function formatDate(d?: string | null) {
  if (!d) return null
  const x = new Date(d)
  if (isNaN(x.getTime())) return null
  return x.toLocaleDateString()
}

function sortForProduction(a: Order, b: Order) {
  const pa = typeof a.productionPriority === 'number' ? a.productionPriority : Number.POSITIVE_INFINITY
  const pb = typeof b.productionPriority === 'number' ? b.productionPriority : Number.POSITIVE_INFINITY
  if (pa !== pb) return pa - pb

  const sa = a.requestedShipDate ? +new Date(a.requestedShipDate) : Number.POSITIVE_INFINITY
  const sb = b.requestedShipDate ? +new Date(b.requestedShipDate) : Number.POSITIVE_INFINITY
  if (sa !== sb) return sa - sb

  const ca = a.createdAt ? +new Date(a.createdAt) : 0
  const cb = b.createdAt ? +new Date(b.createdAt) : 0
  return ca - cb
}

function clampText(s?: string | null) {
  if (!s) return ''
  return s.length > 38 ? s.slice(0, 38) + '…' : s
}

export default function ProductionBoardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [auto, setAuto] = useState(true)
  const [fs, setFs] = useState(false)

  // collapsed groups
  const [openFactories, setOpenFactories] = useState<Record<string, boolean>>({})
  const [showDone, setShowDone] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)

  // modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)

  const [editPriority, setEditPriority] = useState<string>('')
  const [editShipDate, setEditShipDate] = useState<string>('') // yyyy-mm-dd

  const load = async () => {
    try {
      setError(null)
      const list = await fetchAllOrders()
      setOrders(list)
    } catch (e: any) {
      setOrders([])
      setError(e?.message || 'Failed to load')
    }
  }

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await load()
      setLoading(false)
    })()
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

  // Group: Factory -> Status -> Orders
  const factories = useMemo(() => {
    const map: Record<string, Record<FlowStatus, Order[]>> = {}

    const getFactory = (o: Order) => o.factoryLocation?.name || 'Unknown Factory'
    const statusAllowed = (s: FlowStatus) => {
      if (s === 'COMPLETED') return showDone
      if (s === 'CANCELED') return showCanceled
      return true
    }

    for (const o of orders) {
      if (!statusAllowed(o.status)) continue
      const f = getFactory(o)
      map[f] ||= {
        PENDING_PAYMENT_APPROVAL: [],
        IN_PRODUCTION: [],
        PRE_SHIPPING: [],
        COMPLETED: [],
        CANCELED: [],
      }
      map[f][o.status].push(o)
    }

    const names = Object.keys(map).sort((a, b) => a.localeCompare(b))
    // default open (solo la primera vez)
    setTimeout(() => {
      setOpenFactories((prev) => {
        if (Object.keys(prev).length) return prev
        const next: Record<string, boolean> = {}
        names.forEach((n) => (next[n] = true))
        return next
      })
    }, 0)

    // sort within each column
    for (const f of names) {
      for (const st of STATUSES) {
        map[f][st].sort(sortForProduction)
      }
    }

    return { map, names }
  }, [orders, showDone, showCanceled])

  const openModal = (o: Order) => {
    setActive(o)
    setEditPriority(typeof o.productionPriority === 'number' ? String(o.productionPriority) : '')
    if (o.requestedShipDate) {
      const d = new Date(o.requestedShipDate)
      setEditShipDate(!isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '')
    } else {
      setEditShipDate('')
    }
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
    setEditPriority('')
    setEditShipDate('')
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

  // ⚠️ IMPORTANTE:
  // Esto usa tu endpoint /factory (el que ya guarda productionPriority en History page)
  // NECESITAS que el backend trate campos ausentes como "no changes" (no pisar con null).
  const saveProductionMeta = async () => {
    if (!active) return
    setBusy(true)
    try {
      const body: any = {}
      if (editPriority === '') body.productionPriority = null
      else body.productionPriority = Number(editPriority)

      if (editShipDate === '') body.requestedShipDate = null
      else body.requestedShipDate = editShipDate

      const res = await fetch(`/api/admin/orders/${active.id}/factory`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const updated = await safeJson<Order>(res)
      if (!res.ok) throw new Error('Failed to save')
      if (updated?.id) {
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)))
        setActive((prev) => (prev ? { ...prev, ...updated } : prev))
      } else {
        // si tu endpoint no devuelve order completo, por lo menos refrescamos
        await load()
      }
      closeModal()
    } catch {
      alert('Could not save production settings')
    } finally {
      setBusy(false)
    }
  }

  const headerBg = `radial-gradient(1100px 700px at 80% 0%, #E6F7FA 0%, transparent 60%),
    radial-gradient(800px 500px at 10% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
    linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`

  return (
    <div className="min-h-screen p-6" style={{ background: headerBg }}>
      {/* Header */}
      <div className="mb-5 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-3 py-1 border border-slate-200 bg-white/70 text-slate-700">
            <FactoryIcon size={16} />
            Production Board
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
            Order of fabrication by factory
          </h1>
          <p className="text-slate-600">
            Sorts by <span className="font-semibold">Priority</span> → Ship date → Created.
          </p>
          {error && (
            <p className="mt-2 text-sm text-rose-700 inline-flex items-center gap-2">
              <AlertTriangle size={16} /> {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              setRefreshing(true)
              await load()
              setRefreshing(false)
            }}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
            Refresh
          </button>

          <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold cursor-pointer">
            <input
              type="checkbox"
              className="accent-sky-600"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />
            Auto
          </label>

          <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold cursor-pointer">
            <input
              type="checkbox"
              className="accent-emerald-600"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Show completed
          </label>

          <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold cursor-pointer">
            <input
              type="checkbox"
              className="accent-rose-600"
              checked={showCanceled}
              onChange={(e) => setShowCanceled(e.target.checked)}
            />
            Show canceled
          </label>

          <button
            onClick={toggleFS}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
            title={fs ? 'Exit full screen' : 'Full screen'}
          >
            {fs ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {fs ? 'Exit' : 'Full screen'}
          </button>

          <div
            className="h-1 w-24 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl p-6 shadow-[0_12px_40px_rgba(0,122,153,0.10)]">
            <div className="h-4 w-56 bg-slate-200/70 rounded animate-pulse" />
            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-56 rounded-2xl bg-slate-200/60 animate-pulse" />
              ))}
            </div>
          </div>
        ) : factories.names.length === 0 ? (
          <div className="p-10 text-center rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)]">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <PackageSearch size={28} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No orders</h3>
            <p className="text-slate-600">Nothing to schedule. Lucky you.</p>
          </div>
        ) : (
          factories.names.map((fname) => {
            const isOpen = openFactories[fname] ?? true
            const toggle = () =>
              setOpenFactories((prev) => ({ ...prev, [fname]: !(prev[fname] ?? true) }))

            const columns = factories.map[fname]

            // counts (solo visibles)
            const count =
              columns.PENDING_PAYMENT_APPROVAL.length +
              columns.IN_PRODUCTION.length +
              columns.PRE_SHIPPING.length +
              (showDone ? columns.COMPLETED.length : 0) +
              (showCanceled ? columns.CANCELED.length : 0)

            return (
              <section
                key={fname}
                className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] overflow-hidden"
              >
                <header className="px-4 py-3 bg-slate-50/60 border-b border-white/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={toggle}
                      className="rounded-lg p-1.5 hover:bg-white border border-transparent hover:border-slate-200 transition"
                      aria-label="Toggle factory"
                    >
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <h2 className="font-black text-slate-900 truncate">{fname}</h2>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 border border-white">
                      {count} orders
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 hidden sm:block">
                    Click a card to set priority / ship date.
                  </div>
                </header>

                {isOpen && (
                  <div className="p-4">
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                      {STATUSES.filter((s) => {
                        if (s === 'COMPLETED') return showDone
                        if (s === 'CANCELED') return showCanceled
                        return true
                      }).map((st) => {
                        const items = columns[st] || []
                        const style = STATUS_STYLE[st]

                        return (
                          <div
                            key={st}
                            className="rounded-2xl border border-white bg-white/70 overflow-hidden shadow-[0_10px_28px_rgba(0,0,0,0.06)]"
                          >
                            <div className={`px-3 py-2 ${style.head} border-b border-white/60`}>
                              <div className="flex items-center justify-between">
                                <div className={`font-extrabold ${style.text}`}>{STATUS_LABEL[st]}</div>
                                <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 border border-white">
                                  {items.length}
                                </div>
                              </div>
                            </div>

                            <div className={`${style.bg} p-2 space-y-2 min-h-[160px] max-h-[62vh] overflow-y-auto overscroll-contain`}>
                              {items.length === 0 ? (
                                <div className="text-center text-slate-500 text-sm py-6">Empty</div>
                              ) : (
                                items.map((o) => (
                                  <button
                                    key={o.id}
                                    onClick={() => openModal(o)}
                                    className="group w-full text-left rounded-2xl border border-slate-200 bg-white px-3 py-2 ring-1 ring-slate-100 hover:shadow-md transition"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className={`mt-0.5 h-8 w-1.5 rounded-full ${style.rail} shrink-0`} />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="font-semibold text-slate-900 truncate">
                                            {o.poolModel?.name || '—'}
                                          </div>
                                          {typeof o.productionPriority === 'number' && (
                                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                                              <Hash size={12} /> {o.productionPriority}
                                            </span>
                                          )}
                                        </div>

                                        <div className="text-[12px] text-slate-600 truncate">
                                          {o.dealer?.name || 'Dealer'} • {o.color?.name || '—'}
                                        </div>

                                        <div className="mt-1 flex items-center gap-2 text-[12px] text-slate-600">
                                          {o.requestedShipDate ? (
                                            <span className="inline-flex items-center gap-1">
                                              <CalendarDays size={14} />
                                              {formatDate(o.requestedShipDate) ?? '—'}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500">Ship: —</span>
                                          )}
                                          <span className="text-slate-300">•</span>
                                          <span className="truncate">{clampText(o.deliveryAddress)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )
          })
        )}
      </div>

      {/* Modal */}
      {open && active && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="w-full max-w-2xl rounded-2xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,.15)] overflow-hidden"
          >
            <header className="px-5 py-4 border-b bg-white/80 sticky top-0 z-10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 truncate">
                    {active.poolModel?.name || 'Order'} • {active.color?.name || '—'}
                  </h3>
                  <p className="text-sm text-slate-600 truncate">
                    {active.dealer?.name || 'Dealer'} • {active.factoryLocation?.name || 'Factory'}
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="rounded-lg p-2 hover:bg-slate-100"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Field label="Order ID">{active.id}</Field>
                <Field label="Status">
                  <StatusPill status={active.status} />
                </Field>
                <Field label="Created">
                  {active.createdAt ? new Date(active.createdAt).toLocaleString() : '—'}
                </Field>
                <Field label="Delivery address" wrap>
                  {active.deliveryAddress || '—'}
                </Field>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900 mb-3">Production settings</div>

                  <label className="block mb-3">
                    <div className="text-xs font-semibold text-slate-600 mb-1">Priority (1 = highest)</div>
                    <input
                      type="number"
                      min={1}
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                      placeholder="Leave blank to clear"
                      disabled={busy}
                    />
                  </label>

                  <label className="block">
                    <div className="text-xs font-semibold text-slate-600 mb-1">Requested ship date</div>
                    <input
                      type="date"
                      value={editShipDate}
                      onChange={(e) => setEditShipDate(e.target.value)}
                      className="w-full h-10 rounded-xl border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300"
                      disabled={busy}
                    />
                  </label>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={closeModal}
                      disabled={busy}
                      className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveProductionMeta}
                      disabled={busy}
                      className="h-10 px-4 rounded-xl bg-sky-700 text-white font-semibold hover:bg-sky-800 disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border bg-white p-3">
                  <div className="text-sm font-semibold text-slate-900 mb-2">Links</div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/orders/${active.id}/history`}
                      className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                    >
                      <ExternalLink size={16} /> History
                    </Link>

                    <Link
                      href={`/admin/orders/${active.id}/media`}
                      className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-800"
                    >
                      <ExternalLink size={16} /> Files
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-spin-slow { animation: spin 1.2s linear infinite; }
      `}</style>
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
      <div className={`font-medium text-slate-900 ${wrap ? '' : 'truncate'}`}>{children}</div>
    </div>
  )
}

function StatusPill({ status }: { status: FlowStatus }) {
  const base = 'inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>Pending</span>
    case 'IN_PRODUCTION':
      return <span className={`${base} bg-indigo-50 text-indigo-800 border-indigo-200`}>In Production</span>
    case 'PRE_SHIPPING':
      return <span className={`${base} bg-violet-50 text-violet-800 border-violet-200`}>Pre-Shipping</span>
    case 'COMPLETED':
      return <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>Completed</span>
    case 'CANCELED':
      return <span className={`${base} bg-rose-50 text-rose-800 border-rose-200`}>Canceled</span>
    default:
      return <span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>{status}</span>
  }
}