// app/(admin)/admin/page.tsx
'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { PackageSearch, CheckCircle2, Clock, CircleCheckBig, CircleX } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

type FactoryRow = {
  factoryId: string
  factoryName: string
  totals: Record<string, number>
}

type Metrics = {
  totals: Record<string, number>
  monthly: { key: string; label: string; count: number }[]
  recent: { id: string; dealer: string; model: string; color: string; factory: string; status: string; createdAt: string }[]
  byFactory: FactoryRow[]
}

const emptyMetrics: Metrics = {
  totals: { total: 0, PENDING_PAYMENT_APPROVAL: 0, APPROVED: 0, IN_PRODUCTION: 0, COMPLETED: 0 },
  monthly: [],
  recent: [],
  byFactory: [],
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      router.push('/login')
      return
    }
    ;(async () => {
      try {
        const res = await fetch('/api/admin/metrics', { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) setMetrics(data)
        else setMetrics(emptyMetrics)
      } catch {
        setMetrics(emptyMetrics)
      } finally {
        setLoading(false)
      }
    })()
  }, [session, status, router])

  const aqua = '#00B2CA'
  const deep = '#007A99'
  const t = useMemo(() => metrics.totals, [metrics])

  if (loading) return <div className="p-2 text-slate-600">Loading…</div>

  const Stat = ({ label, value, Icon }:{
    label: string; value: number | string; Icon: any
  }) => (
    <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-600 text-sm">{label}</p>
        <Icon size={18} className="text-slate-500" />
      </div>
      <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-600">
          Welcome, {session?.user?.email} ({session?.user?.role})
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-5 gap-4 mb-6">
        <Stat label="Total Orders" value={t.total || 0} Icon={PackageSearch} />
        <Stat label="Pending" value={t.PENDING_PAYMENT_APPROVAL || 0} Icon={Clock} />
        <Stat label="Approved" value={t.APPROVED || 0} Icon={CheckCircle2} />
        <Stat label="In Production" value={t.IN_PRODUCTION || 0} Icon={CircleCheckBig} />
        <Stat label="Completed" value={t.COMPLETED || 0} Icon={CircleX} />
      </div>

      {/* Chart + Recent */}
      <div className="grid xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900">Orders last 6 months</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.monthly}>
                <defs>
                  <linearGradient id="gradAdmin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={aqua} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={deep} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke={deep} fill="url(#gradAdmin)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
          <h3 className="text-lg font-bold text-slate-900 mb-3">Recent orders</h3>
          {metrics.recent.length === 0 ? (
            <div className="text-slate-500">No recent orders.</div>
          ) : (
            <div className="space-y-3">
              {metrics.recent.map((o) => (
                <div key={o.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{o.dealer} • {o.factory}</div>
                    <div className="text-sm text-slate-600">
                      {o.model} ({o.color}) • {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                    {o.status.replaceAll('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* By factory */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
        <h3 className="text-lg font-bold text-slate-900 mb-3">By factory</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="text-left py-2 pr-4">Factory</th>
                <th className="text-right py-2 px-3">Total</th>
                <th className="text-right py-2 px-3">Pending</th>
                <th className="text-right py-2 px-3">Approved</th>
                <th className="text-right py-2 px-3">In Prod.</th>
                <th className="text-right py-2 px-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byFactory.map((f) => (
                <tr key={f.factoryId} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-900">{f.factoryName}</td>
                  <td className="py-2 px-3 text-right">{f.totals.total}</td>
                  <td className="py-2 px-3 text-right">{f.totals.PENDING_PAYMENT_APPROVAL}</td>
                  <td className="py-2 px-3 text-right">{f.totals.APPROVED}</td>
                  <td className="py-2 px-3 text-right">{f.totals.IN_PRODUCTION}</td>
                  <td className="py-2 px-3 text-right">{f.totals.COMPLETED}</td>
                </tr>
              ))}
              {metrics.byFactory.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-slate-500">No data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}