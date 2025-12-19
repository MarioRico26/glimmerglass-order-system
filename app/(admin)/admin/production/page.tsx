'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  RefreshCw, Maximize2, Minimize2, X, ExternalLink, GripVertical,
  Calendar, Hash
} from 'lucide-react'
import Link from 'next/link'

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
  status: OrderStatus
  paymentProofUrl?: string | null
  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factoryLocation: Maybe<{ name: string }>
  createdAt?: string
  requestedShipDate?: string | null
  productionPriority?: number | null
}

type ApiOrders = { items: Order[]; total?: number } | Order[]

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

function statusPill(status: OrderStatus) {
  const base = 'px-2 py-1 rounded-full text-xs font-semibold border'
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

function sortKey(o: Order) {
  const p = typeof o.productionPriority === 'number' ? o.productionPriority : 999999
  const ship = o.requestedShipDate ? +new Date(o.requestedShipDate) : 9999999999999
  const created = o.createdAt ? +new Date(o.createdAt) : 0
  // prioridad asc (1 primero), ship asc, created desc (más nuevo arriba dentro del empate)
  return [p, ship, -created, o.id]
}

export default function ProductionBoardByFactory() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [auto, setAuto] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showCanceled, setShowCanceled] = useState(false)

  const [fs, setFs] = useState(false)

  // Modal
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Order | null>(null)
  const [busy, setBusy] = useState(false)
  const modalRef = useRef<HTMLDivElement | null>(null)

  // Drag state
  const dragRef = useRef<{ id: string; fromFactory: string } | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)

      // 👇 usa pageSize=100 para no reventar tu validación del API
      const res = await fetch(`/api/admin/orders?page=1&pageSize=100&sort=createdAt&dir=desc`, { cache: 'no-store' })
      if (!res.ok) {
        const msg = (await safeJson<{ message?: string }>(res))?.message || 'Failed to load orders'
        throw new Error(msg)
      }
      const data = await safeJson<ApiOrders>(res)
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data!.items : []
      setOrders(list)
    } catch (e: any) {
      setOrders([])
      setError(e?.message || 'Failed to load orders')
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

  const visibleOrders = useMemo(() => {
    return orders.filter(o => {
      if (!showCompleted && o.status === 'COMPLETED') return false
      if (!showCanceled && o.status === 'CANCELED') return false
      return true
    })
  }, [orders, showCompleted, showCanceled])

  const factories = useMemo(() => {
    const s = new Set<string>()
    visibleOrders.forEach(o => s.add(o.factoryLocation?.name || 'Unknown Factory'))
    return Array.from(s).sort()
  }, [visibleOrders])

  const byFactory = useMemo(() => {
    const map: Record<string, Order[]> = {}
    factories.forEach(f => (map[f] = []))
    visibleOrders.forEach(o => {
      const f = o.factoryLocation?.name || 'Unknown Factory'
      ;(map[f] ||= []).push(o)
    })
    Object.keys(map).forEach(f => {
      map[f].sort((a, b) => {
        const ka = sortKey(a)
        const kb = sortKey(b)
        for (let i = 0; i < ka.length; i++) {
          if (ka[i] < kb[i]) return -1
          if (ka[i] > kb[i]) return 1
        }
        return 0
      })
    })
    return map
  }, [visibleOrders, factories])

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

  const saveSchedule = async (id: string, productionPriority: number | null, requestedShipDate: string | null) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/orders/${id}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionPriority, requestedShipDate }),
      })
      if (!res.ok) throw new Error((await safeJson<{ message?: string }>(res))?.message || 'Failed to save')
      const updated = await safeJson<Order>(res)
      if (updated?.id) {
        setOrders(prev => prev.map(o => (o.id === id ? { ...o, ...updated } : o)))
        setActive(prev => (prev?.id === id ? { ...prev, ...updated } : prev))
      }
    } catch (e: any) {
      alert(e?.message || 'Could not save schedule')
    } finally {
      setBusy(false)
    }
  }

  // ✅ Drag & drop: reordenar dentro de la MISMA fábrica
  const onDragStart = (id: string, fromFactory: string) => {
    dragRef.current = { id, fromFactory }
  }

  const onDrop = async (toId: string, toFactory: string) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return

    // Por ahora: reordenar SOLO dentro de la misma fábrica.
    // (Mover entre fábricas es otra historia y debería cambiar factoryLocationId.)
    if (drag.fromFactory !== toFactory) return

    const list = [...(byFactory[toFactory] || [])]
    const fromIdx = list.findIndex(o => o.id === drag.id)
    const toIdx = list.findIndex(o => o.id === toId)
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return

    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)

    // Reasigna prioridades 1..N (solo a los visibles de esa fábrica)
    const updates = list.map((o, i) => ({ id: o.id, productionPriority: i + 1 }))

    // Optimistic UI
    setOrders(prev => {
      const map = new Map(prev.map(o => [o.id, o]))
      updates.forEach(u => {
        const cur = map.get(u.id)
        if (cur) map.set(u.id, { ...cur, productionPriority: u.productionPriority })
      })
      return Array.from(map.values())
    })

    // Persist
    try {
      const res = await fetch(`/api/admin/orders/schedule/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) throw new Error((await safeJson<{ message?: string }>(res))?.message || 'Failed to save order')
    } catch (e: any) {
      alert(e?.message || 'Could not save new order')
      // recarga para volver a estado real
      await load()
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
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6 mb-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold rounded-full px-3 py-1 border border-slate-200 bg-white/80 text-slate-700">
              PRODUCTION BOARD
            </div>
            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900">
              Order of fabrication by factory
            </h1>
            <p className="mt-2 text-slate-600">
              Drag cards to set <strong>Priority</strong>. Sorts by <strong>Priority → Ship date → Created</strong>.
            </p>
            {error && <p className="mt-2 text-sm text-rose-700">⚠️ {error}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => { setRefreshing(true); await load(); setRefreshing(false) }}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
              Refresh
            </button>

            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer">
              <input type="checkbox" className="accent-sky-600" checked={auto} onChange={e => setAuto(e.target.checked)} />
              Auto
            </label>

            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer">
              <input type="checkbox" className="accent-sky-600" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
              Show completed
            </label>

            <label className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold cursor-pointer">
              <input type="checkbox" className="accent-sky-600" checked={showCanceled} onChange={e => setShowCanceled(e.target.checked)} />
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

            <div className="h-1 w-24 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }} />
          </div>
        </div>
      </div>

      {/* Columns by factory */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
        {factories.map(factoryName => {
          const list = byFactory[factoryName] || []
          return (
            <section
              key={factoryName}
              className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,122,153,0.10)] overflow-hidden"
            >
              <header className="px-5 py-4 bg-white/70 border-b border-white/70 sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">{factoryName}</div>
                    <div className="text-xs text-slate-600">Priority → Ship date → Created</div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                    {list.length}
                  </span>
                </div>
              </header>

              <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {loading && (
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-24 rounded-3xl bg-white border border-slate-200 animate-pulse" />
                    ))}
                  </div>
                )}

                {!loading && list.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-10">
                    No orders
                  </div>
                )}

                {!loading && list.map((o) => (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => onDragStart(o.id, factoryName)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(o.id, factoryName)}
                    className="group rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:shadow-[0_16px_40px_rgba(2,132,199,0.10)] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button onClick={() => openModal(o)} className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">
                            {o.poolModel?.name || 'Model'} <span className="text-slate-400">•</span> {o.color?.name || '-'}
                          </div>
                          <span className="shrink-0">{statusPill(o.status)}</span>
                        </div>
                        <div className="mt-1 text-sm text-slate-600 truncate">
                          {o.dealer?.name || 'Dealer'} <span className="text-slate-400">•</span> {o.deliveryAddress || '—'}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                            <Hash size={14} /> Priority: {typeof o.productionPriority === 'number' ? o.productionPriority : '—'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                            <Calendar size={14} /> Ship: {fmtDate(o.requestedShipDate || null)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                            Created: {fmtDate(o.createdAt || null)}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-2xl border border-slate-200 bg-white text-slate-500 cursor-grab active:cursor-grabbing">
                          <GripVertical size={18} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm">
                      <Link
                        href={`/admin/orders/${o.id}/history`}
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      >
                        <ExternalLink size={16} /> History
                      </Link>
                      <Link
                        href={`/admin/orders/${o.id}/media`}
                        className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                      >
                        <ExternalLink size={16} /> Files
                      </Link>
                      {o.paymentProofUrl && (
                        <a
                          href={o.paymentProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                        >
                          <ExternalLink size={16} /> Payment
                        </a>
                      )}
                    </div>
                  </div>
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
            className="w-full max-w-2xl rounded-3xl border border-white bg-white/90 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,.20)] overflow-hidden"
          >
            <header className="px-6 py-5 border-b bg-white/80">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs font-black tracking-wider text-slate-500">ORDER</div>
                  <div className="text-2xl font-black text-slate-900 truncate">
                    {active.poolModel?.name || 'Order'} • {active.color?.name || '-'}
                  </div>
                  <div className="text-slate-600 truncate">
                    {active.dealer?.name || 'Dealer'} • {active.factoryLocation?.name || 'Factory'}
                  </div>
                </div>
                <button onClick={closeModal} className="rounded-2xl p-3 hover:bg-slate-100 border border-transparent hover:border-slate-200">
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="p-6 grid sm:grid-cols-2 gap-5 bg-slate-50/60">
              <Field label="Order ID" mono wrap>{active.id}</Field>
              <Field label="Status">{statusPill(active.status)}</Field>
              <Field label="Created">{fmtDateTime(active.createdAt || null)}</Field>
              <Field label="Delivery address" wrap>{active.deliveryAddress || '—'}</Field>
              <Field label="Factory">{active.factoryLocation?.name || '—'}</Field>
              <Field label="Payment proof">
                {active.paymentProofUrl ? (
                  <a href={active.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                    View file
                  </a>
                ) : 'Not uploaded'}
              </Field>
            </div>

            <div className="p-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="font-bold text-slate-900 mb-3">Scheduling</div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Priority (1 = first)</label>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      defaultValue={active.productionPriority ?? ''}
                      className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3"
                      id="priorityInput"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600">Requested ship date</label>
                    <input
                      type="date"
                      defaultValue={active.requestedShipDate ? new Date(active.requestedShipDate).toISOString().slice(0,10) : ''}
                      className="mt-1 w-full h-10 rounded-xl border border-slate-200 bg-white px-3"
                      id="shipDateInput"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    Tip: drag cards in the column to rewrite priorities automatically.
                  </div>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      const pEl = document.getElementById('priorityInput') as HTMLInputElement | null
                      const sEl = document.getElementById('shipDateInput') as HTMLInputElement | null
                      const pRaw = pEl?.value ?? ''
                      const sRaw = sEl?.value ?? ''
                      const p = pRaw === '' ? null : Number(pRaw)
                      const ship = sRaw === '' ? null : new Date(sRaw + 'T00:00:00.000Z').toISOString()
                      await saveSchedule(active.id, p, ship)
                    }}
                    className="inline-flex items-center justify-center h-10 px-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 disabled:opacity-50"
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
        .animate-spin-slow { animation: spin 1.2s linear infinite; }
      `}</style>
    </div>
  )
}

function Field({
  label,
  children,
  wrap = false,
  mono = false,
}: { label: string; children: React.ReactNode; wrap?: boolean; mono?: boolean }) {
  return (
    <div className="text-sm">
      <div className="text-slate-500">{label}</div>
      <div className={`${mono ? 'font-mono' : 'font-semibold'} text-slate-900 ${wrap ? '' : 'truncate'}`}>
        {children}
      </div>
    </div>
  )
}