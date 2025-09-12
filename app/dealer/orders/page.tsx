'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PackageSearch, Palette, Truck, Clock, CheckCircle2, CircleCheckBig, CircleX, FileText } from 'lucide-react'

type Order = {
  id: string
  poolModel: { name: string }
  color: { name: string }
  status: string
  deliveryAddress: string
  paymentProofUrl: string
  notes?: string | null
  createdAt: string
}

const aqua = '#00B2CA'
const deep = '#007A99'

function StatusBadge({ status }: { status: string }) {
  const base = 'text-xs font-semibold px-2 py-1 rounded-full'
  const map: Record<string, string> = {
    PENDING_PAYMENT_APPROVAL: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-sky-100 text-sky-700',
    IN_PRODUCTION: 'bg-indigo-100 text-indigo-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    CANCELED: 'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`${base} ${map[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

export default function MyOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/dealer/orders')
        const data = await res.json()
        if (!res.ok) throw new Error(data?.message || 'Failed to load orders')
        setOrders(Array.isArray(data?.orders) ? data.orders : [])
      } catch (e: any) {
        setError(e?.message || 'Error loading orders')
      } finally {
        setLoading(false)
      }
    })()
  }, [status])

  const hasOrders = useMemo(() => orders.length > 0, [orders])

  if (status === 'loading') {
    return <div className="p-6 text-slate-600">Loading session…</div>
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">My Orders</h1>
        <p className="text-slate-600">Track your recent orders and open their history.</p>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
              <div className="h-5 w-40 bg-slate-100 rounded mb-3" />
              <div className="h-4 w-28 bg-slate-100 rounded mb-6" />
              <div className="h-4 w-full bg-slate-100 rounded mb-2" />
              <div className="h-4 w-2/3 bg-slate-100 rounded mb-2" />
              <div className="h-9 w-36 bg-slate-100 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 text-rose-700 p-4">
          {error}
        </div>
      ) : !hasOrders ? (
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
          <p className="text-slate-600">No orders found.</p>
          <Link
            href="/dealer/new-order"
            className="inline-block mt-3 text-sm font-semibold text-slate-800 hover:underline"
          >
            Create your first order →
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <PackageSearch size={18} className="text-slate-500" />
                  <h3 className="font-bold text-slate-900">{o.poolModel?.name}</h3>
                </div>
                <StatusBadge status={o.status} />
              </div>

              <div className="text-sm text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Palette size={16} className="text-slate-400" />
                  <span><span className="text-slate-500">Color:</span> {o.color?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span>
                    <span className="text-slate-500">Created:</span>{' '}
                    {o.createdAt ? new Date(o.createdAt).toLocaleString() : '-'}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Truck size={16} className="text-slate-400 mt-0.5" />
                  <span className="line-clamp-3">
                    <span className="text-slate-500">Delivery:</span> {o.deliveryAddress}
                  </span>
                </div>
                {o.notes ? (
                  <div className="flex items-start gap-2">
                    <FileText size={16} className="text-slate-400 mt-0.5" />
                    <span className="line-clamp-3">
                      <span className="text-slate-500">Notes:</span> {o.notes}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <a
                  href={o.paymentProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 inline-flex items-center justify-center rounded-xl text-white font-semibold px-3 shadow-lg hover:shadow-md transition"
                  style={{ backgroundImage: 'linear-gradient(90deg,#00B2CA,#007A99)' }}
                >
                  Payment proof
                </a>
                <Link
                  href={`/dealer/orders/${o.id}/history`}
                  className="h-9 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-3"
                >
                  History & Media
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-8 h-1 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
      />
    </div>
  )
}