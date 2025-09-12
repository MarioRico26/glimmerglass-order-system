// app/admin/dealers/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FileSignature, Search, XCircle } from 'lucide-react'

type Row = {
    id: string
    name: string | null
    email: string | null
    city: string | null
    state: string | null
    createdAt: string
    approved: boolean
    agreementSignedAt: string | null
    agreementUrl: string | null
    onboardingStatus: 'PENDING_APPROVAL' | 'APPROVED_WAITING_SIGNATURE' | 'ACTIVE'
}

type Overview = {
    items: (Omit<Row, 'createdAt' | 'agreementSignedAt'> & {
        createdAt: Date
        agreementSignedAt: Date | null
    })[],
    totals: { all: number; pendingApproval: number; waitingSignature: number; active: number }
}

const aqua = '#00B2CA'
const deep = '#007A99'

export default function AdminDealersPage() {
    const [data, setData] = useState<Overview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [q, setQ] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | Row['onboardingStatus']>('ALL')
    const [busyId, setBusyId] = useState<string | null>(null)

    const load = async () => {
        try {
            setLoading(true); setError(null)
            const res = await fetch('/api/admin/dealers/overview', { cache: 'no-store' })
            if (!res.ok) throw new Error(await res.text())
            const json = await res.json()
            // parse fechas
            const items = (json.items as Row[]).map(r => ({
                ...r,
                createdAt: new Date(r.createdAt),
                agreementSignedAt: r.agreementSignedAt ? new Date(r.agreementSignedAt) : null,
            }))
            setData({ items, totals: json.totals })
        } catch (e:any) {
            setError(e?.message || 'Failed to load')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const filtered = useMemo(() => {
        if (!data) return []
        return data.items.filter(r => {
            const matchQ =
                !q ||
                (r.name?.toLowerCase().includes(q.toLowerCase()) ||
                    r.email?.toLowerCase().includes(q.toLowerCase()) ||
                    r.city?.toLowerCase().includes(q.toLowerCase()) ||
                    r.state?.toLowerCase().includes(q.toLowerCase()))
            const matchStatus = statusFilter === 'ALL' || r.onboardingStatus === statusFilter
            return matchQ && matchStatus
        })
    }, [data, q, statusFilter])

    const toggleApproval = async (row: Row) => {
        try {
            setBusyId(row.id)
            const res = await fetch('/api/admin/dealers/approve', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealerId: row.id, approved: !row.approved }),
            })
            if (!res.ok) throw new Error(await res.text())
            await load()
        } catch (e) {
            console.error(e)
            alert('Failed to update approval')
        } finally {
            setBusyId(null)
        }
    }

    const Stat = ({ label, value }: { label: string; value: number }) => (
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
            <div className="text-slate-600 text-sm">{label}</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{value}</div>
        </div>
    )

    const Badge = ({ s }: { s: Row['onboardingStatus'] }) => {
        if (s === 'PENDING_APPROVAL')
            return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">Pending approval</span>
        if (s === 'APPROVED_WAITING_SIGNATURE')
            return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-sky-100 text-sky-800">Waiting signature</span>
        return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">Active</span>
    }

    if (loading) return <div className="p-6 text-slate-600">Loading…</div>
    if (error)   return <div className="p-6 text-rose-600">{error}</div>
    if (!data)   return <div className="p-6 text-slate-600">No data.</div>

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Dealers</h1>
                    <p className="text-slate-600">Onboarding overview & quick actions.</p>
                </div>
                <div
                    className="h-2 w-24 rounded-full"
                    style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
                />
            </div>

            {/* Stats */}
            <div className="grid sm:grid-cols-4 gap-4">
                <Stat label="All" value={data.totals.all} />
                <Stat label="Pending approval" value={data.totals.pendingApproval} />
                <Stat label="Waiting signature" value={data.totals.waitingSignature} />
                <Stat label="Active" value={data.totals.active} />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Search size={16} />
          </span>
                    <input
                        placeholder="Search by name, email, city or state"
                        value={q}
                        onChange={e=>setQ(e.target.value)}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3"
                    />
                </div>
                <div className="inline-flex gap-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
                    {(['ALL','PENDING_APPROVAL','APPROVED_WAITING_SIGNATURE','ACTIVE'] as const).map(s => (
                        <button
                            key={s}
                            onClick={()=>setStatusFilter(s as any)}
                            className={[
                                'px-3 py-1 rounded-lg transition',
                                statusFilter === s ? 'bg-white shadow' : 'text-slate-600'
                            ].join(' ')}
                        >
                            {s === 'ALL' ? 'All' :
                                s === 'PENDING_APPROVAL' ? 'Pending' :
                                    s === 'APPROVED_WAITING_SIGNATURE' ? 'Waiting signature' : 'Active'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)]">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                    <tr className="text-left">
                        <th className="p-3">Dealer</th>
                        <th className="p-3">Location</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Agreement</th>
                        <th className="p-3">Created</th>
                        <th className="p-3">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-6 text-slate-500 text-center">No results</td>
                        </tr>
                    )}
                    {filtered.map(r => (
                        <tr key={r.id} className="border-t border-slate-100">
                            <td className="p-3">
                                <div className="font-semibold text-slate-900">{r.name || '—'}</div>
                                <div className="text-slate-600">{r.email || '—'}</div>
                            </td>
                            <td className="p-3 text-slate-700">
                                {(r.city || '—') + (r.state ? `, ${r.state}` : '')}
                            </td>
                            <td className="p-3"><Badge s={r.onboardingStatus} /></td>
                            <td className="p-3">
                                {r.agreementUrl ? (
                                    <Link
                                        href={r.agreementUrl}
                                        target="_blank"
                                        className="inline-flex items-center gap-1 text-slate-800 hover:underline"
                                    >
                                        <FileSignature size={16} /> View PDF
                                    </Link>
                                ) : (
                                    <span className="text-slate-500">—</span>
                                )}
                            </td>
                            <td className="p-3 text-slate-700">
                                {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={()=>toggleApproval(r as any)}
                                        disabled={busyId === r.id}
                                        className={[
                                            'h-9 rounded-lg px-3 text-xs font-semibold border',
                                            r.approved
                                                ? 'border-rose-200 bg-white hover:bg-rose-50 text-rose-700'
                                                : 'border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700'
                                        ].join(' ')}
                                        title={r.approved ? 'Disable dealer' : 'Approve dealer'}
                                    >
                                        {busyId === r.id
                                            ? 'Saving…'
                                            : r.approved
                                                ? (<span className="inline-flex items-center gap-1"><XCircle size={14}/> Disable</span>)
                                                : (<span className="inline-flex items-center gap-1"><CheckCircle2 size={14}/> Approve</span>)
                                        }
                                    </button>
                                    {/* Acceso rápido a notificaciones del dealer (opcional): */}
                                    {/* <Link href={`/admin/dealers/${r.id}/notes`} className="text-xs underline">Notes</Link> */}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Stripe */}
            <div
                className="h-1 w-full rounded-full"
                style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            />
        </div>
    )
}