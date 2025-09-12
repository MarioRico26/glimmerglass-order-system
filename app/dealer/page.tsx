// app/dealer/page.tsx
'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    PlusCircle,
    PackageSearch,
    CheckCircle2,
    Clock,
    CircleCheckBig,
    XCircle
} from 'lucide-react'
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts'
import SignOutButton from '@/components/SignOutButton'
import OnboardingChecklist from '@/app/api/dealer/components/OnboardingChecklist' // ✅ ruta corregida

type Metrics = {
    dealer: { id: string; name: string | null }
    totals: Record<string, number>
    monthly: { key: string; label: string; count: number }[]
    recent: { id: string; model: string; color: string; status: string; createdAt: string }[]
}

export default function DealerDashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'loading') return
        if (!session || session.user?.role !== 'DEALER') {
            router.push('/login')
            return
        }
        ;(async () => {
            try {
                setError(null)
                const res = await fetch('/api/dealer/metrics', { cache: 'no-store' })
                if (!res.ok) {
                    if (res.status === 401) {
                        router.push('/login')
                        return
                    }
                    throw new Error(await res.text())
                }
                const data = (await res.json()) as Metrics
                setMetrics(data)
            } catch (e: any) {
                setError('Failed to load metrics')
                console.error(e)
            } finally {
                setLoading(false)
            }
        })()
    }, [session, status, router])

    const aqua = '#00B2CA'
    const deep = '#007A99'

    const t = useMemo(() => metrics?.totals ?? {}, [metrics])

    const Stat = ({
                      label,
                      value,
                      Icon,
                  }: {
        label: string
        value: number | string
        Icon: any
    }) => (
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
            <div className="flex items-center justify-between">
                <p className="text-slate-600 text-sm">{label}</p>
                <Icon size={18} className="text-slate-500" />
            </div>
            <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
        </div>
    )

    if (loading) return <div className="p-6 text-slate-600">Loading…</div>
    if (error)   return <div className="p-6 text-slate-600">{error}</div>
    if (!metrics) return <div className="p-6 text-slate-600">No data.</div>

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Welcome back</h1>
                    <p className="text-slate-600">
                        {metrics.dealer.name ?? session?.user?.email}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/dealer/new-order"
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-white font-semibold shadow-lg transition-transform active:scale-[0.99]"
                        style={{ backgroundImage: 'linear-gradient(90deg,#00B2CA,#007A99)' }}
                    >
                        <PlusCircle size={18} />
                        New Order
                    </Link>
                    <SignOutButton variant="icon" />
                </div>
            </div>

            {/* ✅ Onboarding Checklist (antes de las stats) */}
            <OnboardingChecklist />

            {/* Stats */}
            <div className="grid sm:grid-cols-6 gap-4 mb-6">
                <Stat label="Total Orders" value={t.total ?? 0} Icon={PackageSearch} />
                <Stat label="Pending" value={t.PENDING_PAYMENT_APPROVAL ?? 0} Icon={Clock} />
                <Stat label="Approved" value={t.APPROVED ?? 0} Icon={CheckCircle2} />
                <Stat label="In Production" value={t.IN_PRODUCTION ?? 0} Icon={CircleCheckBig} />
                <Stat label="Completed" value={t.COMPLETED ?? 0} Icon={CheckCircle2} />
                <Stat label="Canceled" value={t.CANCELED ?? 0} Icon={XCircle} />
            </div>

            {/* Chart + Recent */}
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-slate-900">Orders last 6 months</h3>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.monthly}>
                                <defs>
                                    <linearGradient id="dealerGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={aqua} stopOpacity={0.8} />
                                        <stop offset="100%" stopColor={deep} stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e6eef2" />
                                <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, borderColor: '#e6eef2' }}
                                    labelStyle={{ color: '#0f172a' }}
                                />
                                <Area type="monotone" dataKey="count" stroke={deep} fill="url(#dealerGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Recent orders</h3>
                    <div className="space-y-3">
                        {metrics.recent.map((o) => (
                            <div key={o.id} className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-slate-900">{o.model}</div>
                                    <div className="text-sm text-slate-600">
                                        {o.color} • {new Date(o.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {o.status.replaceAll('_', ' ')}
                </span>
                            </div>
                        ))}
                        {metrics.recent.length === 0 && (
                            <div className="text-slate-500">No orders yet.</div>
                        )}
                    </div>
                    <Link
                        href="/dealer/orders"
                        className="mt-4 inline-flex text-sm font-semibold text-slate-800 hover:underline"
                    >
                        View all
                    </Link>
                </div>
            </div>
        </div>
    )
}