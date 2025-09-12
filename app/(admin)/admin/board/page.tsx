'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RefreshCw, Maximize2, Minimize2, X, PackageSearch,
  CheckCircle2, Clock, CircleCheckBig, CircleX, ExternalLink
} from 'lucide-react'
import Link from 'next/link'

type Maybe<T> = T | null | undefined
type OrderStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'APPROVED'
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELED'

interface Order {
  id: string
  deliveryAddress: string
  status: OrderStatus
  paymentProofUrl?: string | null
  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factory?: Maybe<{ name: string }>
  createdAt?: string
}

type ApiOrders = { items: Order[] } | Order[]

const aqua = '#00B2CA'
const deep = '#007A99'

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

const NEXT_STATUSES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT_APPROVAL: ['APPROVED', 'CANCELED'],
  APPROVED: ['IN_PRODUCTION', 'CANCELED'],
  IN_PRODUCTION: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
}

const STATUS_COLORS = {
  PENDING_PAYMENT_APPROVAL: { bg: 'bg-amber-50',   text: 'text-amber-800',   head: 'bg-amber-100/70',   rail: 'bg-amber-200'   },
  APPROVED:                 { bg: 'bg-sky-50',     text: 'text-sky-800',     head: 'bg-sky-100/70',     rail: 'bg-sky-200'     },
  IN_PRODUCTION:            { bg: 'bg-indigo-50',  text: 'text-indigo-800',  head: 'bg-indigo-100/70',  rail: 'bg-indigo-200'  },
  COMPLETED:                { bg: 'bg-emerald-50', text: 'text-emerald-800', head: 'bg-emerald-100/70', rail: 'bg-emerald-200' },
  CANCELED:                 { bg: 'bg-rose-50',    text: 'text-rose-800',    head: 'bg-rose-100/70',    rail: 'bg-rose-200'    },
} as const

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch { return null }
}

export default function AdminStatusBoard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [auto, setAuto] = useState(true)
  const [fs, setFs] = useState(false)

  // Modal state
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Order | null>(null)
  const [detail, setDetail] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/orders', { cache: 'no-store' })
      if (!res.ok) throw new Error((await safeJson<{ message?: string }>(res))?.message || 'Failed to load')
      const data = await safeJson<ApiOrders>(res)
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data!.items : []
      setOrders(list)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  const grouped = useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      PENDING_PAYMENT_APPROVAL: [],
      APPROVED: [],
      IN_PRODUCTION: [],
      COMPLETED: [],
      CANCELED: [],
    }
    orders.forEach(o => map[o.status]?.push(o))
    ;(Object.keys(map) as OrderStatus[]).forEach(s => {
      map[s].sort((a, b) => {
        const da = a.createdAt ? +new Date(a.createdAt) : 0
        const db = b.createdAt ? +new Date(b.createdAt) : 0
        return db - da || a.id.localeCompare(b.id)
      })
    })
    return map
  }, [orders])

  /** Modal helpers */
  const openModal = async (o: Order) => {
    setActive(o)
    setDetail(o) // base mientras cargamos detalle
    setOpen(true)
    // intenta enriquecer si existe endpoint show
    try {
      const res = await fetch(`/api/admin/orders/${o.id}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await safeJson<Order>(res)
        if (data) setDetail(prev => ({ ...prev!, ...data }))
      }
    } catch {}
  }

  const closeModal = () => {
    setOpen(false)
    setActive(null)
    setDetail(null)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
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

  const patchStatus = async (id: string, status: OrderStatus) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      // actualizar lista
      const updated = await safeJson<Order>(res)
      if (updated) {
        setOrders(prev => prev.map(o => (o.id === id ? updated : o)))
        setDetail(prev => (prev ? { ...prev, ...updated } : updated))
      }
    } catch (e) {
      alert('Could not update status')
    } finally {
      setBusy(false)
    }
  }

  const approvePayment = async (id: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}/approve`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to approve order')
      const updated = await safeJson<Order>(res)
      if (updated) {
        setOrders(prev => prev.map(o => (o.id === id ? updated : o)))
        setDetail(prev => (prev ? { ...prev, ...updated } : updated))
      }
    } catch {
      alert('Could not approve order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen p-6"
      style={{
        background:
          `radial-gradient(1100px 700px at 80% 0%, #E6F7FA 0%, transparent 60%),
           radial-gradient(800px 500px at 10% 90%, rgba(0,178,202,0.10) 0%, transparent 60%),
           linear-gradient(180deg, #F7FBFD 0%, #EBF6F9 100%)`,
      }}
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-3 py-1 border border-slate-200 bg-white/70 text-slate-700">
            Production Status Board
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
            Live Orders Overview
          </h1>
          {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
            Refresh
          </button>
          <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold cursor-pointer">
            <input type="checkbox" className="accent-sky-600" checked={auto} onChange={e=>setAuto(e.target.checked)} />
            Auto
          </label>
          <button
            onClick={toggleFS}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
            title={fs ? 'Exit full screen' : 'Full screen'}
          >
            {fs ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            {fs ? 'Exit' : 'Full screen'}
          </button>
          <div className="h-1 w-24 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }} />
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((st) => {
          const items = grouped[st] || []
          const c = STATUS_COLORS[st]
          return (
            <section
              key={st}
              className="isolate rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] ring-1 ring-white/60 flex flex-col overflow-hidden"
            >
              <header className={`sticky top-0 z-10 px-4 py-3 ${c.head} border-b border-white/70`}>
                <div className="flex items-center justify-between min-w-0">
                  <h2 className={`text-lg font-extrabold ${c.text} leading-tight whitespace-nowrap`}>
                    {STATUS_LABEL[st]}
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/80 border border-white">
                    {items.length}
                  </span>
                </div>
              </header>

              <div className={`p-3 space-y-2 ${c.bg} max-h-[70vh] overflow-y-auto overscroll-contain`}>
                {loading && (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-11 rounded-2xl bg-white/70 border border-slate-200 animate-pulse" />
                    ))}
                  </div>
                )}

                {!loading && items.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-10">No orders</div>
                )}

                {!loading && items.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => openModal(o)}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white ring-1 ring-slate-100 flex items-center gap-3 px-3 py-2 w-full text-left"
                  >
                    <span className={`h-8 w-1.5 rounded-full ${c.rail} shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {o.poolModel?.name || 'Model'}
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                          {o.color?.name || '-'}
                        </span>
                      </div>
                      <div className="text-[13px] text-slate-600 truncate leading-tight">
                        {(o.dealer?.name || 'Dealer') + ' • ' + (o.factory?.name || 'Factory')}
                      </div>
                    </div>
                    <div className="ml-2 text-[11px] text-slate-500 shrink-0 whitespace-nowrap">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''}
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition"
                      style={{ boxShadow: '0 0 0 2px rgba(0,178,202,.25) inset' }}
                    />
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Modal */}
      {open && active && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            ref={modalRef}
            className="w-full max-w-2xl rounded-2xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,.15)] overflow-hidden"
          >
            <header className="px-5 py-4 border-b bg-white/80 sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 truncate">
                    {detail?.poolModel?.name || 'Order'} • {detail?.color?.name || '-'}
                  </h3>
                  <p className="text-sm text-slate-600 truncate">
                    {detail?.dealer?.name || 'Dealer'} • {detail?.factory?.name || 'Factory'}
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
                  <StatusBadge status={detail?.status || active.status} />
                </Field>
                <Field label="Created">
                  {active.createdAt ? new Date(active.createdAt).toLocaleString() : '—'}
                </Field>
                <Field label="Delivery address" wrap>
                  {active.deliveryAddress || '—'}
                </Field>
              </div>

              <div className="space-y-2">
                <Field label="Dealer">{detail?.dealer?.name || '—'}</Field>
                <Field label="Factory">{detail?.factory?.name || '—'}</Field>
                <Field label="Payment proof">
                  {detail?.paymentProofUrl ? (
                    <a
                      href={detail.paymentProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-700 underline"
                    >
                      <PackageSearch size={16} /> View file
                    </a>
                  ) : (
                    'Not uploaded'
                  )}
                </Field>
                <Field label="History">
                  <Link
                    href={`/admin/orders/${active.id}/history`}
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                  >
                    <ExternalLink size={16} /> Open order history
                  </Link>
                </Field>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-sm font-semibold text-slate-900 mb-2">Quick actions</div>
                <div className="flex flex-wrap gap-2">
                  {active.status === 'PENDING_PAYMENT_APPROVAL' && (
                    <button
                      disabled={busy}
                      onClick={() => approvePayment(active.id)}
                      className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} /> Approve payment
                    </button>
                  )}

                  {(NEXT_STATUSES[detail?.status || active.status] || []).map(next => {
                    const [Icon, cls] =
                      next === 'IN_PRODUCTION' ? [Clock, 'bg-indigo-600 hover:bg-indigo-700'] :
                      next === 'COMPLETED' ? [CircleCheckBig, 'bg-emerald-600 hover:bg-emerald-700'] :
                      next === 'CANCELED' ? [CircleX, 'bg-rose-600 hover:bg-rose-700'] :
                      [CheckCircle2, 'bg-sky-600 hover:bg-sky-700']

                    return (
                      <button
                        key={next}
                        disabled={busy}
                        onClick={() => patchStatus(active.id, next)}
                        className={`inline-flex items-center gap-1 text-white px-3 py-2 rounded-lg disabled:opacity-50 ${cls}`}
                      >
                        <Icon size={16} /> {STATUS_LABEL[next]}
                      </button>
                    )
                  })}
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

/** ---------- UI bits ---------- */
function Field({
  label,
  children,
  wrap = false,
}: { label: string; children: React.ReactNode; wrap?: boolean }) {
  return (
    <div className="text-sm">
      <div className="text-slate-500">{label}</div>
      <div className={`font-medium text-slate-900 ${wrap ? '' : 'truncate'}`}>{children}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: OrderStatus | string }) {
  const base = 'px-2 py-1 rounded-full text-xs font-semibold'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>
    case 'APPROVED':
      return <span className={`${base} bg-blue-100 text-blue-800`}>Approved</span>
    case 'IN_PRODUCTION':
      return <span className={`${base} bg-indigo-100 text-indigo-800`}>In Production</span>
    case 'COMPLETED':
      return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>
    case 'CANCELED':
      return <span className={`${base} bg-red-100 text-red-800`}>Canceled</span>
    default:
      return <span className={`${base} bg-slate-100 text-slate-700`}>{String(status)}</span>
  }
}