'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
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
  ExternalLink,
  AlertTriangle,
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
  const base =
    'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap'

  switch (status) {
    case 'PENDING_PAYMENT_APPROVAL':
      return (
        <span className={`${base} bg-amber-50 text-amber-800 border-amber-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      )
    case 'IN_PRODUCTION':
      return (
        <span className={`${base} bg-indigo-50 text-indigo-800 border-indigo-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          In Production
        </span>
      )
    case 'PRE_SHIPPING':
      return (
        <span className={`${base} bg-violet-50 text-violet-800 border-violet-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
          Pre-Shipping
        </span>
      )
    case 'COMPLETED':
      return (
        <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Completed
        </span>
      )
    case 'CANCELED':
      return (
        <span className={`${base} bg-rose-50 text-rose-800 border-rose-200`}>
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Canceled
        </span>
      )
    default:
      return (
        <span className={`${base} bg-slate-50 text-slate-700 border-slate-200`}>
          {labelStatus(status)}
        </span>
      )
  }
}

function SkeletonRow() {
  return (
    <tr className="border-t border-slate-100">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="py-4 px-4">
          <div className="h-3 w-full max-w-[220px] animate-pulse rounded bg-slate-200/70" />
        </td>
      ))}
    </tr>
  )
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={[
        'text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500',
        className,
      ].join(' ')}
    >
      {children}
    </th>
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

  function renderNextStep(order: Order) {
    const s = order.status as FlowStatus
    const disabled = busyId === order.id
    const cancellable = order.status !== 'COMPLETED' && order.status !== 'CANCELED'

    const cancelBtn = (
      <button
        disabled={disabled || !cancellable}
        onClick={() => updateStatus(order.id, 'CANCELED')}
        className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
        title="Cancel order"
      >
        <CircleX size={16} />
      </button>
    )

    if (s === 'PENDING_PAYMENT_APPROVAL') {
      return (
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            onClick={() => updateStatus(order.id, 'IN_PRODUCTION')}
            className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            title="Move to In Production (requirements enforced)"
          >
            <Clock size={16} /> Start
          </button>
          {cancelBtn}
        </div>
      )
    }

    if (s === 'IN_PRODUCTION') {
      return (
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            onClick={() => updateStatus(order.id, 'PRE_SHIPPING')}
            className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-violet-600 text-white text-xs font-semibold shadow-sm hover:bg-violet-700 disabled:opacity-50"
            title="Move to Pre-Shipping"
          >
            <Truck size={16} /> Pre-Ship
          </button>
          {cancelBtn}
        </div>
      )
    }

    if (s === 'PRE_SHIPPING') {
      return (
        <div className="flex items-center gap-2">
          <button
            disabled={disabled}
            onClick={() => updateStatus(order.id, 'COMPLETED')}
            className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            title="Complete order"
          >
            <CircleCheckBig size={16} /> Complete
          </button>
          {cancelBtn}
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
          <AlertTriangle size={14} />
          No step
        </span>
        {cancelBtn}
      </div>
    )
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
            {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={exportUrl()}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold"
            >
              <FileText size={16} />
              Export CSV
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
              className="hidden sm:block h-1 w-32 rounded-full"
              style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            />
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
              placeholder="Search (model, dealer, factory, address)"
              className="pl-8 pr-3 h-10 rounded-xl border border-slate-200 bg-white w-72 max-w-[85vw]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] overflow-hidden">
        {loading ? (
          <div className="overflow-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-white">
                <tr>
                  <Th className="w-[170px]">Model</Th>
                  <Th className="w-[200px]">Dealer</Th>
                  <Th>Address</Th>
                  <Th className="w-[150px]">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort('status')}>
                      Status <ArrowUpDown size={14} />
                    </button>
                  </Th>
                  <Th className="w-[210px]">Next step</Th>
                  <Th className="w-[150px]">Links</Th>
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
          <div className="divide-y divide-slate-100">
            {Object.entries(grouped).map(([groupName, list]) => {
              const open = openGroups[groupName] ?? true
              const toggle = () => setOpenGroups((prev) => ({ ...prev, [groupName]: !open }))

              return (
                <section key={groupName}>
                  <header className="flex items-center justify-between px-4 py-3 bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggle}
                        className="rounded-lg hover:bg-white p-1 border border-transparent hover:border-slate-200 transition"
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
                    <div className="overflow-auto">
                      <table className="w-full text-sm table-fixed">
                        {/* Premium sticky header */}
                        <thead className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-slate-100">
                          <tr>
                            <Th className="w-[170px]">Model</Th>
                            <Th className="w-[200px]">Dealer</Th>
                            <Th>Address</Th>
                            <Th className="w-[150px]">Status</Th>
                            <Th className="w-[210px]">Next step</Th>
                            <Th className="w-[150px]">Links</Th>
                          </tr>
                        </thead>

                        <tbody>
                          {list.map((order) => {
                            return (
                              <tr
                                key={order.id}
                                className="border-t border-slate-100 hover:bg-slate-50/60 transition"
                              >
                                {/* Model */}
                                <td className="py-4 px-4">
                                  <Link
                                    href={`/admin/orders/${order.id}/history`}
                                    prefetch={false}
                                    className="text-sky-700 hover:underline font-semibold"
                                    title="Open order details"
                                  >
                                    {order.poolModel?.name || '-'}
                                  </Link>

                                  {/* Secondary info (only when space exists) */}
                                  <div className="hidden xl:block mt-1 text-xs text-slate-500">
                                    <span className="font-semibold text-slate-600">Factory:</span>{' '}
                                    {order.factoryLocation?.name || 'Not set'}
                                  </div>
                                </td>

                                {/* Dealer */}
                                <td className="py-4 px-4">
                                  <div className="truncate text-slate-900 font-medium" title={order.dealer?.name || ''}>
                                    {order.dealer?.name || 'Unknown Dealer'}
                                  </div>

                                  <div className="hidden 2xl:block mt-1 text-xs text-slate-500">
                                    <span className="font-semibold text-slate-600">Created:</span>{' '}
                                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                                  </div>
                                </td>

                                {/* Address */}
                                <td className="py-4 px-4">
                                  <div
                                    className="text-slate-700 break-words whitespace-normal leading-snug line-clamp-2"
                                    title={order.deliveryAddress}
                                  >
                                    {order.deliveryAddress}
                                  </div>

                                  {/* Payment quick link when there's room */}
                                  <div className="hidden xl:flex mt-2 items-center gap-2 text-xs">
                                    <span className="text-slate-500">Payment:</span>
                                    {order.paymentProofUrl ? (
                                      <a
                                        href={order.paymentProofUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sky-700 hover:underline font-semibold"
                                        title="View payment proof"
                                      >
                                        <ExternalLink size={14} />
                                        View
                                      </a>
                                    ) : (
                                      <span className="text-slate-500">Not uploaded</span>
                                    )}
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="py-4 px-4">
                                  <StatusBadge status={order.status} />
                                </td>

                                {/* Next Step + Quick actions */}
                                <td className="py-4 px-4">
                                  {renderNextStep(order)}
                                </td>

                                {/* Links */}
                                <td className="py-4 px-4">
                                  <div className="grid gap-2">
                                    <Link
                                      href={`/admin/orders/${order.id}/history`}
                                      prefetch={false}
                                      className="inline-flex items-center justify-center gap-2 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                                      title="Open order"
                                    >
                                      <PackageSearch size={16} />
                                      Open
                                    </Link>

                                    <Link
                                      href={`/admin/orders/${order.id}/media`}
                                      prefetch={false}
                                      className="inline-flex items-center justify-center gap-2 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                                      title="Files"
                                    >
                                      <FileText size={16} />
                                      Files
                                    </Link>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
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