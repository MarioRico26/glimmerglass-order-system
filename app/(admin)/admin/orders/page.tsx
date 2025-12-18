'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  CircleCheckBig,
  CircleX,
  Clock,
  FileText,
  PackageSearch,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  Group,
  Factory as FactoryIcon,
  UserCircle2,
  RefreshCw,
  ArrowUpDown,
  Truck,
} from 'lucide-react'

import MissingRequirementsModal from '@/components/admin/MissingRequirementsModal'
import { STATUS_LABELS, type FlowStatus } from '@/lib/orderFlow'

type Maybe<T> = T | null | undefined

interface Order {
  id: string
  deliveryAddress: string
  status: string
  paymentProofUrl?: string | null
  poolModel: Maybe<{ name: string }>
  color: Maybe<{ name: string }>
  dealer: Maybe<{ name: string }>
  factoryLocation: Maybe<{ name: string }>
  createdAt?: string
}

type ApiResp = {
  items: Order[]
  page: number
  pageSize: number
  total: number
}

type MissingPayload = {
  code?: string
  message?: string
  targetStatus?: string
  missing?: {
    docs?: string[]
    fields?: string[]
  }
}

const aqua = '#00B2CA'
const deep = '#007A99'

// ✅ APPROVED eliminado del UI (y del filtro)
const ALL_STATUS = [
  'PENDING_PAYMENT_APPROVAL',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
  'CANCELED',
] as const
type StatusKey = typeof ALL_STATUS[number]

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function labelStatus(status: string) {
  const key = status as FlowStatus
  return STATUS_LABELS[key] ?? status.replaceAll('_', ' ')
}

function StatusBadge({ status }: { status: string }) {
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
      return <span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>{labelStatus(status)}</span>
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

  // Missing requirements modal state
  const [missingOpen, setMissingOpen] = useState(false)
  const [missingDocs, setMissingDocs] = useState<string[]>([])
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [missingTarget, setMissingTarget] = useState<string | null>(null)
  const [missingUploadHref, setMissingUploadHref] = useState<string | null>(null)

  const q = sp.get('q') || ''
  const statusFilter = (sp.get('status') as StatusKey | 'ALL') || 'ALL'
  const dealerFilter = sp.get('dealer') || 'ALL'
  const factoryFilter = sp.get('factory') || 'ALL'
  const sort = sp.get('sort') || 'createdAt'
  const dir = sp.get('dir') || 'desc'
  const page = Math.max(1, Number(sp.get('page') || 1))
  const pageSize = Math.max(5, Number(sp.get('pageSize') || 20))

  const setParams = (patch: Record<string, string | number | undefined | null>) => {
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
      setOrders(data?.items ?? [])
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, dealerFilter, factoryFilter, sort, dir, page, pageSize])

  const [refreshing, setRefreshing] = useState(false)
  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const openMissing = (orderId: string, nextStatus: string, payload: MissingPayload | null) => {
    setMissingTarget(payload?.targetStatus ?? nextStatus)
    setMissingDocs(payload?.missing?.docs ?? [])
    setMissingFields(payload?.missing?.fields ?? [])
    setMissingUploadHref(`/admin/orders/${orderId}/media`)
    setMissingOpen(true)
  }

  // ✅ único lugar para cambiar status: /status
  const updateStatus = async (orderId: string, newStatus: FlowStatus) => {
    try {
      setBusyId(orderId)

      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment: 'Status changed from Orders list' }),
      })

      const payload = await safeJson<any>(res)

      if (!res.ok) {
        if (payload?.code === 'MISSING_REQUIREMENTS') {
          openMissing(orderId, newStatus, payload as MissingPayload)
          return
        }
        throw new Error(payload?.message || 'Failed to update status')
      }

      const updated = payload as Order
      if (!updated?.id) throw new Error('Invalid response')
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)))

      // no manual history here. /status already creates history.
      router.refresh()
    } catch (e: any) {
      alert(e?.message || 'Could not update status')
    } finally {
      setBusyId(null)
    }
  }

  const dealers = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => s.add(o.dealer?.name || 'Unknown Dealer'))
    return Array.from(s).sort()
  }, [orders])

  const factories = useMemo(() => {
    const s = new Set<string>()
    orders.forEach((o) => s.add(o.factoryLocation?.name || 'Unknown Factory'))
    return Array.from(s).sort()
  }, [orders])

  const [groupBy, setGroupBy] = useState<'DEALER' | 'FACTORY'>('DEALER')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  function groupKeys(list: Order[], g: 'DEALER' | 'FACTORY') {
    const s = new Set<string>()
    const keyer =
      g === 'DEALER'
        ? (o: Order) => o.dealer?.name || 'Unknown Dealer'
        : (o: Order) => o.factoryLocation?.name || 'Unknown Factory'
    list.forEach((o) => s.add(keyer(o)))
    return Array.from(s).sort()
  }

  useEffect(() => {
    const keys = groupKeys(orders, groupBy)
    const map = keys.reduce((acc, k) => {
      acc[k] = true
      return acc
    }, {} as Record<string, boolean>)
    setOpenGroups(map)
  }, [orders, groupBy])

  const grouped = useMemo(() => {
    const keyer =
      groupBy === 'DEALER'
        ? (o: Order) => o.dealer?.name || 'Unknown Dealer'
        : (o: Order) => o.factoryLocation?.name || 'Unknown Factory'

    return orders.reduce((acc, o) => {
      const k = keyer(o)
      ;(acc[k] ||= []).push(o)
      return acc
    }, {} as Record<string, Order[]>)
  }, [orders, groupBy])

  // total count (mantengo tu patrón)
  const [totalCount, setTotalCount] = useState(0)
  useEffect(() => {
    ;(async () => {
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
      const data = (await safeJson<ApiResp>(res)) || { total: 0, items: [], page: 1, pageSize: 20 }
      setTotalCount(data.total || 0)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, statusFilter, dealerFilter, factoryFilter, sort, dir, page, pageSize])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

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

  // ✅ helper para next-step button
  function renderNextAction(order: Order) {
    const s = order.status as FlowStatus
    const disabled = busyId === order.id

    // ✅ flow sin APPROVED:
    // PENDING_PAYMENT_APPROVAL -> IN_PRODUCTION -> PRE_SHIPPING -> COMPLETED
    if (s === 'PENDING_PAYMENT_APPROVAL') {
      return (
        <button
          disabled={disabled}
          onClick={() => updateStatus(order.id, 'IN_PRODUCTION')}
          className="inline-flex items-center gap-1 bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
          title="Move to In Production (requires payment docs, then serial/build docs per rules)"
        >
          <Clock size={16} /> Start Prod.
        </button>
      )
    }

    if (s === 'IN_PRODUCTION') {
      return (
        <button
          disabled={disabled}
          onClick={() => updateStatus(order.id, 'PRE_SHIPPING')}
          className="inline-flex items-center gap-1 bg-violet-600 text-white px-2 py-1 rounded hover:bg-violet-700 disabled:opacity-50"
          title="Move to Pre-Shipping"
        >
          <Truck size={16} /> Pre-Ship
        </button>
      )
    }

    if (s === 'PRE_SHIPPING') {
      return (
        <button
          disabled={disabled}
          onClick={() => updateStatus(order.id, 'COMPLETED')}
          className="inline-flex items-center gap-1 bg-emerald-600 text-white px-2 py-1 rounded hover:bg-emerald-700 disabled:opacity-50"
          title="Complete order"
        >
          <CircleCheckBig size={16} /> Completed
        </button>
      )
    }

    return null
  }

  return (
    <div className="space-y-6">
      <MissingRequirementsModal
        open={missingOpen}
        onClose={() => setMissingOpen(false)}
        targetStatus={missingTarget}
        missingDocs={missingDocs}
        missingFields={missingFields}
        goToUploadHref={missingUploadHref}
      />

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
            <div className="h-1 w-32 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }} />
          </div>
        </div>
      </div>

      {/* Filters */}
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
              {ALL_STATUS.map((s) => (
                <option key={s} value={s}>
                  {labelStatus(s)}
                </option>
              ))}
            </select>

            <UserCircle2 size={16} className="text-slate-500" />
            <select
              value={dealerFilter}
              onChange={(e) => setParams({ dealer: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              <option value="ALL">All dealers</option>
              {dealers.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <FactoryIcon size={16} className="text-slate-500" />
            <select
              value={factoryFilter}
              onChange={(e) => setParams({ factory: e.target.value, page: 1 })}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3"
            >
              <option value="ALL">All factories</option>
              {factories.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
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

      {/* Table */}
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
              const toggle = () => setOpenGroups((prev) => ({ ...prev, [groupName]: !open }))

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
                            <th className="text-left py-2 px-3">Status</th>
                            <th className="text-left py-2 px-3">Payment</th>
                            <th className="text-left py-2 px-3">Created</th>
                            <th className="text-left py-2 px-3">Actions</th>
                            <th className="text-left py-2 px-3">History</th>
                            <th className="text-left py-2 px-3">Files</th>
                          </tr>
                        </thead>

                        <tbody>
                          {list.map((order) => (
                            <tr key={order.id} className="border-t">
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
                              <td className="py-2 px-3">{order.factoryLocation?.name || 'Unknown Factory'}</td>
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
                                ) : (
                                  <span className="text-slate-500">Not uploaded</span>
                                )}
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

                                  {renderNextAction(order)}

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

                              <td className="py-2 px-3">
                                <Link
                                  href={`/admin/orders/${order.id}/history`}
                                  prefetch={false}
                                  className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                                  title="Order timeline"
                                >
                                  <Clock size={16} /> History
                                </Link>
                              </td>

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

      {/* Pagination */}
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
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </div>
      </div>

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 1.2s linear infinite;
        }
      `}</style>
    </div>
  )
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading orders…</div>}>
      <AdminOrdersInner />
    </Suspense>
  )
}