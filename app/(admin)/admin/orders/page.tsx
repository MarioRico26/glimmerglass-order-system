'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2, CircleCheckBig, CircleX, Clock, FileText, PackageSearch,
  ChevronDown, ChevronRight, Filter, Search, Group, Factory as FactoryIcon,
  UserCircle2, RefreshCw, ArrowUpDown
} from 'lucide-react'

type Maybe<T> = T | null | undefined

interface Order {
  id: string
  deliveryAddress: string
  status: string
  paymentProofUrl?: string | null
  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factory: Maybe<{ name: string }>
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

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

const ALL_STATUS = [
  'PENDING_PAYMENT_APPROVAL',
  'APPROVED',
  'IN_PRODUCTION',
  'COMPLETED',
  'CANCELED',
] as const
type StatusKey = typeof ALL_STATUS[number]

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function StatusBadge({ status }: { status: string }) {
  const base = 'px-2 py-1 rounded-full text-xs font-semibold'
  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL': return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>
    case 'APPROVED':                 return <span className={`${base} bg-blue-100 text-blue-800`}>Approved</span>
    case 'IN_PRODUCTION':            return <span className={`${base} bg-indigo-100 text-indigo-800`}>In Production</span>
    case 'COMPLETED':                return <span className={`${base} bg-green-100 text-green-800`}>Completed</span>
    case 'CANCELED':                 return <span className={`${base} bg-red-100 text-red-800`}>Canceled</span>
    default:                         return <span className={`${base} bg-slate-100 text-slate-700`}>{status}</span>
  }
}

function SkeletonRow() {
  return (
    <tr className="border-t">
      {Array.from({ length: 11 }).map((_, i) => (
        <td key={i} className="py-3 px-3">
          <div className="h-3 w-full max-w-[180px] animate-pulse rounded bg-slate-200/70" />
        </td>
      ))}
    </tr>
  )
}

function AdminOrdersInner() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Query state (fuente = URL)
  const q            = sp.get('q') || ''
  const statusFilter = (sp.get('status') as StatusKey | 'ALL') || 'ALL'
  const dealerFilter = sp.get('dealer') || 'ALL'
  const factoryFilter= sp.get('factory') || 'ALL'
  const sort         = sp.get('sort') || 'createdAt'
  const dir          = sp.get('dir') || 'desc'
  const page         = Math.max(1, Number(sp.get('page') || 1))
  const pageSize     = Math.max(5, Number(sp.get('pageSize') || 20))

  const setParams = (patch: Record<string,string|number|undefined|null>) => {
    const params = new URLSearchParams(sp.toString())
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') params.delete(k)
      else params.set(k, String(v))
    })
    router.replace(`${pathname}?${params.toString()}`)
  }

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (dealerFilter !== 'ALL') params.set('dealer', dealerFilter)
      if (factoryFilter !== 'ALL') params.set('factory', factoryFilter)
      params.set('sort', sort)
      params.set('dir', dir)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error((await safeJson<{ message?: string }>(res))?.message || 'Failed')
      const data = await safeJson<ApiResp>(res)
      const list = data?.items ?? []
      setOrders(list)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [q,statusFilter,dealerFilter,factoryFilter,sort,dir,page,pageSize])

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const updateStatus = async (orderId: string, newStatus: StatusKey) => {
    try {
      setBusyId(orderId)
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      const updated = await safeJson<Order>(res)
      if (!updated) throw new Error('Invalid response')
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)))
    } catch {
      alert('Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  const approveOrder = async (orderId: string) => {
    try {
      setBusyId(orderId)
      const res = await fetch(`/api/admin/orders/${orderId}/approve`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Failed to approve order')
      const updated = await safeJson<Order>(res)
      if (!updated) throw new Error('Invalid response')
      setOrders(prev => prev.map(o => (o.id === orderId ? updated : o)))
    } catch {
      alert('Could not approve order')
    } finally {
      setBusyId(null)
    }
  }

  // Catálogos para selects (derivados de los datos actuales)
  const dealers = useMemo(() => {
    const s = new Set<string>()
    orders.forEach(o => s.add(o.dealer?.name || 'Unknown Dealer'))
    return Array.from(s).sort()
  }, [orders])

  const factories = useMemo(() => {
    const s = new Set<string>()
    orders.forEach(o => s.add(o.factory?.name || 'Unknown Factory'))
    return Array.from(s).sort()
  }, [orders])

  // Agrupado en cliente
  const [groupBy, setGroupBy] = useState<'DEALER' | 'FACTORY'>('DEALER')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const keys = groupKeys(orders, groupBy)
    const map = keys.reduce((acc, k) => { acc[k] = true; return acc }, {} as Record<string, boolean>)
    setOpenGroups(map)
  }, [orders, groupBy])

  const grouped = useMemo(() => {
    const keyer =
      groupBy === 'DEALER'
        ? (o: Order) => o.dealer?.name || 'Unknown Dealer'
        : (o: Order) => o.factory?.name || 'Unknown Factory'
    return orders.reduce((acc, o) => {
      const k = keyer(o); (acc[k] ||= []).push(o); return acc
    }, {} as Record<string, Order[]>)
  }, [orders, groupBy])

  function groupKeys(list: Order[], g: 'DEALER' | 'FACTORY') {
    const s = new Set<string>()
    const keyer =
      g === 'DEALER'
        ? (o: Order) => o.dealer?.name || 'Unknown Dealer'
        : (o: Order) => o.factory?.name || 'Unknown Factory'
    list.forEach(o => s.add(keyer(o)))
    return Array.from(s).sort()
  }

  // Paginación
  const [totalCount, setTotalCount] = useState(0)
  useEffect(() => {
    ;(async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      if (dealerFilter !== 'ALL') params.set('dealer', dealerFilter)
      if (factoryFilter !== 'ALL') params.set('factory', factoryFilter)
      params.set('sort', sort); params.set('dir', dir)
      params.set('page', String(page)); params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/admin/orders?${params.toString()}`, { cache: 'no-store' })
      const data = (await res.json()) as ApiResp
      setTotalCount(data.total)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q,statusFilter,dealerFilter,factoryFilter,sort,dir,page,pageSize])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const Stat = ({ label, value, Icon }: { label: string; value: number | string; Icon: any }) => (
    <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-600 text-sm">{label}</p>
        <Icon size={18} className="text-slate-500" />
      </div>
      <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
    </div>
  )

  const toggleSort = (col: 'createdAt' | 'status') => {
    const nextDir = sort === col ? (dir === 'asc' ? 'desc' : 'asc') : 'desc'
    setParams({ sort: col, dir: nextDir, page: 1 })
  }

  const exportUrl = () => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (dealerFilter !== 'ALL') params.set('dealer', dealerFilter)
    if (factoryFilter !== 'ALL') params.set('factory', factoryFilter)
    params.set('sort', sort)
    params.set('dir', dir)
    return `/api/admin/orders/export?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Order Management</h1>
            <p className="text-slate-600">Review, filter and update orders</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={exportUrl()}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
            >
              <FileText size={16} />
              Export CSV (filters)
            </a>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
              title="Refresh"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin-slow' : ''} />
              Refresh
            </button>
            <div
              className="h-1 w-32 rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setParams({ q: e.target.value, page: 1 })}
              placeholder="Search (model, color, dealer, factory, address)"
              className="pl-8 pr-3 h-10 rounded-xl border border-slate-200 bg-white w-72 max-w-[85vw]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setParams({ status: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              <option value="ALL">All statuses</option>
              {ALL_STATUS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>

            <UserCircle2 size={16} className="text-slate-500" />
            <select
              value={dealerFilter}
              onChange={(e) => setParams({ dealer: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              <option value="ALL">All dealers</option>
              {dealers.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <FactoryIcon size={16} className="text-slate-500" />
            <select
              value={factoryFilter}
              onChange={(e) => setParams({ factory: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              <option value="ALL">All factories</option>
              {factories.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <Group size={16} className="text-slate-500" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              <option value="DEALER">Group by dealer</option>
              <option value="FACTORY">Group by factory</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)]">
        {loading ? (
          <div className="overflow-x-auto p-2">
            <table className="min-w-full text-sm">
              <thead className="text-slate-600 bg-slate-50">
                <tr>
                  <th className="text-left py-2 px-3">Model</th>
                  <th className="text-left py-2 px-3">Color</th>
                  <th className="text-left py-2 px-3">Dealer</th>
                  <th className="text-left py-2 px-3">Factory</th>
                  <th className="text-left py-2 px-3">Address</th>
                  <th className="text-left py-2 px-3">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('status')}>
                      Status <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left py-2 px-3">Payment</th>
                  <th className="text-left py-2 px-3">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('createdAt')}>
                      Created <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left py-2 px-3">Actions</th>
                  <th className="text-left py-2 px-3">History</th>
                  <th className="text-left py-2 px-3">Files</th>
                </tr>
              </thead>
              <tbody>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <PackageSearch size={28} className="text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No orders match your filters</h3>
            <p className="text-slate-600">Try changing status, dealer/factory or search.</p>
          </div>
        ) : (
          <div className="divide-y">
            {Object.entries(grouped).map(([groupName, list]) => {
              const open = openGroups[groupName] ?? true
              const toggle = () => setOpenGroups(prev => ({ ...prev, [groupName]: !open }))

              return (
                <section key={groupName}>
                  <header className="flex items-center justify-between px-4 py-3 bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggle}
                        className="rounded hover:bg-white p-1 border border-transparent hover:border-slate-200 transition"
                        aria-label="Toggle group"
                      >
                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <h2 className="font-semibold text-slate-900">
                        {groupBy === 'DEALER' ? 'Dealer' : 'Factory'}: {groupName}
                      </h2>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/60 text-slate-700">
                        {list.length} orders
                      </span>
                    </div>
                  </header>

                  {open && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="text-slate-600 bg-white">
                          <tr>
                            <th className="text-left py-2 px-3">Model</th>
                            <th className="text-left py-2 px-3">Color</th>
                            <th className="text-left py-2 px-3">Dealer</th>
                            <th className="text-left py-2 px-3">Factory</th>
                            <th className="text-left py-2 px-3">Address</th>
                            <th className="text-left py-2 px-3">
                              <button className="inline-flex items-center gap-1" onClick={() => toggleSort('status')}>
                                Status <ArrowUpDown size={14} />
                              </button>
                            </th>
                            <th className="text-left py-2 px-3">Payment</th>
                            <th className="text-left py-2 px-3">
                              <button className="inline-flex items-center gap-1" onClick={() => toggleSort('createdAt')}>
                                Created <ArrowUpDown size={14} />
                              </button>
                            </th>
                            <th className="text-left py-2 px-3">Actions</th>
                            <th className="text-left py-2 px-3">History</th>
                            <th className="text-left py-2 px-3">Files</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map(order => (
                            <tr key={order.id} className="border-t">
                              {/* Model -> link a History */}
                              <td className="py-2 px-3">
                                <Link
                                  href={`/admin/orders/${order.id}/history`}
                                  prefetch={false}
                                  className="text-blue-700 hover:underline font-medium"
                                  title="Open order timeline (History)"
                                >
                                  {order.poolModel?.name || '-'}
                                </Link>
                              </td>

                              <td className="py-2 px-3">{order.color?.name || '-'}</td>
                              <td className="py-2 px-3">{order.dealer?.name || 'Unknown Dealer'}</td>
                              <td className="py-2 px-3">{order.factory?.name || 'Unknown Factory'}</td>
                              <td className="py-2 px-3 max-w-[320px] truncate" title={order.deliveryAddress}>
                                {order.deliveryAddress}
                              </td>
                              <td className="py-2 px-3">
                                <StatusBadge status={order.status} />
                              </td>
                              <td className="py-2 px-3">
                                {order.paymentProofUrl ? (
                                  <a
                                    href={order.paymentProofUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 underline"
                                    title="View payment proof"
                                  >
                                    <FileText size={16} /> View
                                  </a>
                                ) : <span className="text-slate-500">Not uploaded</span>}
                              </td>
                              <td className="py-2 px-3">
                                {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-2">
                                  <Link
                                    href={`/admin/orders/${order.id}/history`}
                                    prefetch={false}
                                    className="inline-flex items-center gap-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-2 py-1 rounded"
                                    title="Open order timeline"
                                  >
                                    <PackageSearch size={16} /> Open
                                  </Link>

                                  {order.status === 'PENDING_PAYMENT_APPROVAL' && (
                                    <button
                                      disabled={busyId === order.id}
                                      onClick={() => approveOrder(order.id)}
                                      className="inline-flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      <CheckCircle2 size={16} /> Approve
                                    </button>
                                  )}
                                  {order.status === 'APPROVED' && (
                                    <button
                                      disabled={busyId === order.id}
                                      onClick={() => updateStatus(order.id, 'IN_PRODUCTION')}
                                      className="inline-flex items-center gap-1 bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                                    >
                                      <Clock size={16} /> Start Prod.
                                    </button>
                                  )}
                                  {order.status === 'IN_PRODUCTION' && (
                                    <button
                                      disabled={busyId === order.id}
                                      onClick={() => updateStatus(order.id, 'COMPLETED')}
                                      className="inline-flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                                    >
                                      <CircleCheckBig size={16} /> Completed
                                    </button>
                                  )}
                                  {order.status !== 'COMPLETED' && order.status !== 'CANCELED' && (
                                    <button
                                      disabled={busyId === order.id}
                                      onClick={() => updateStatus(order.id, 'CANCELED')}
                                      className="inline-flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                                    >
                                      <CircleX size={16} /> Cancel
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Files link */}
                              <td className="py-2 px-3">
                                <Link
                                  href={`/admin/orders/${order.id}/media`}
                                  prefetch={false}
                                  className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                                  title="View & upload files"
                                >
                                  <FileText size={16} /> Files
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Paginación */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong> • {totalCount} results
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setParams({ page: page - 1 })}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white disabled:opacity-50"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setParams({ page: page + 1 })}
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white disabled:opacity-50"
          >
            Next
          </button>
          <select
            value={pageSize}
            onChange={(e) => setParams({ pageSize: Number(e.target.value), page: 1 })}
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm"
          >
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
        </div>
      </div>

      <style jsx global>{`
        .animate-spin-slow { animation: spin 1.2s linear infinite; }
      `}</style>
    </div>
  )
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-slate-600">Loading orders…</div>
    }>
      <AdminOrdersInner />
    </Suspense>
  )
}