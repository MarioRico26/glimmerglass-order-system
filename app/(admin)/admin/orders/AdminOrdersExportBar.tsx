// app/admin/orders/AdminOrdersExportBar.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Filter } from 'lucide-react'

type Dealer = { id: string; name: string; email: string }

const STATUSES = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING_PAYMENT_APPROVAL', label: 'Pending payment approval' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'IN_PRODUCTION', label: 'In production' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELED', label: 'Canceled' },
]

export default function AdminOrdersExportBar() {
    const [status, setStatus] = useState('')
    const [dealerId, setDealerId] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [dealers, setDealers] = useState<Dealer[]>([])
    const [loadingDealers, setLoadingDealers] = useState(false)

    // Cargar dealers para combo (asume que tienes /api/admin/dealers/list)
    useEffect(() => {
        const load = async () => {
            try {
                setLoadingDealers(true)
                const res = await fetch('/api/admin/dealers/list', { cache: 'no-store' })
                if (!res.ok) throw new Error('Failed dealers list')
                const data = await res.json()
                // Normaliza: { id, name, email }
                setDealers((data?.items || []).map((d: any) => ({
                    id: d.id, name: d.name ?? '(no name)', email: d.email,
                })))
            } catch (e) {
                console.error(e)
                setDealers([])
            } finally {
                setLoadingDealers(false)
            }
        }
        load()
    }, [])

    const exportHref = useMemo(() => {
        const params = new URLSearchParams()
        if (status) params.set('status', status)
        if (dealerId) params.set('dealerId', dealerId)
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        const qs = params.toString()
        return `/api/admin/orders/export${qs ? `?${qs}` : ''}`
    }, [status, dealerId, dateFrom, dateTo])

    const aqua = '#00B2CA'
    const deep = '#007A99'

    return (
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 text-slate-700">
                    <Filter size={16} />
                    <span className="font-semibold">Export filters</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Status */}
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[14px]"
                        title="Status"
                    >
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>

                    {/* Dealer */}
                    <select
                        value={dealerId}
                        onChange={(e) => setDealerId(e.target.value)}
                        className="h-10 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-[14px]"
                        title="Dealer"
                    >
                        <option value="">{loadingDealers ? 'Loading dealers…' : 'All dealers'}</option>
                        {dealers.map(d => (
                            <option key={d.id} value={d.id}>
                                {d.name} — {d.email}
                            </option>
                        ))}
                    </select>

                    {/* Date range */}
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[14px]"
                        title="From"
                    />
                    <span className="text-slate-500">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[14px]"
                        title="To"
                    />

                    {/* Export button */}
                    <a
                        href={exportHref}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-white font-semibold shadow-lg"
                        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
                        title="Download CSV"
                    >
                        <Download size={16} />
                        Export CSV
                    </a>
                </div>
            </div>
        </div>
    )
}