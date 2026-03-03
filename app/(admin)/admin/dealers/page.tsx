// app/admin/dealers/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FileSignature, KeyRound, RefreshCw, Search, XCircle } from 'lucide-react'

type Row = {
    id: string
    name: string | null
    email: string | null
    city: string | null
    state: string | null
    createdAt: string
    hasLogin: boolean
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
const STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming',
]

function makeTemporaryPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    let out = ''
    for (let i = 0; i < 12; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)]
    }
    return out
}

export default function AdminDealersPage() {
    const [data, setData] = useState<Overview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [q, setQ] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | Row['onboardingStatus']>('ALL')
    const [busyId, setBusyId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [createOk, setCreateOk] = useState<string | null>(null)
    const [createForm, setCreateForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        createLogin: true,
        approved: true,
    })
    const [resetTarget, setResetTarget] = useState<Row | null>(null)
    const [resetBusy, setResetBusy] = useState(false)
    const [resetError, setResetError] = useState<string | null>(null)
    const [resetOk, setResetOk] = useState<string | null>(null)
    const [resetForm, setResetForm] = useState({
        newPassword: '',
        confirmPassword: '',
    })
    const [enableLoginTarget, setEnableLoginTarget] = useState<Row | null>(null)
    const [enableLoginBusy, setEnableLoginBusy] = useState(false)
    const [enableLoginError, setEnableLoginError] = useState<string | null>(null)
    const [enableLoginForm, setEnableLoginForm] = useState({
        password: makeTemporaryPassword(),
        approved: true,
    })

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

    const createDealer = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreateError(null)
        setCreateOk(null)
        try {
            setCreating(true)
            const res = await fetch('/api/admin/dealers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm),
            })
            const json = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(json?.message || 'Failed to create dealer')
            }

            setCreateOk('Dealer created successfully.')
            setCreateForm({
                name: '',
                email: '',
                password: '',
                phone: '',
                address: '',
                city: '',
                state: '',
                createLogin: true,
                approved: true,
            })
            await load()
        } catch (e: any) {
            setCreateError(e?.message || 'Failed to create dealer')
        } finally {
            setCreating(false)
        }
    }

    const openResetModal = (row: Row) => {
        if (!row.hasLogin) return
        const temp = makeTemporaryPassword()
        setResetTarget(row)
        setResetForm({ newPassword: temp, confirmPassword: temp })
        setResetError(null)
        setResetOk(null)
    }

    const closeResetModal = () => {
        setResetTarget(null)
        setResetForm({ newPassword: '', confirmPassword: '' })
        setResetError(null)
        setResetOk(null)
    }

    const submitResetPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!resetTarget) return
        setResetError(null)
        setResetOk(null)

        if (!resetForm.newPassword || resetForm.newPassword.length < 8) {
            setResetError('Password must be at least 8 characters.')
            return
        }
        if (resetForm.newPassword !== resetForm.confirmPassword) {
            setResetError('Passwords do not match.')
            return
        }

        try {
            setResetBusy(true)
            const res = await fetch(`/api/admin/dealers/${resetTarget.id}/password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: resetForm.newPassword }),
            })
            const json = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(json?.message || 'Failed to reset password')
            }
            setResetOk('Password reset successfully.')
        } catch (e: any) {
            setResetError(e?.message || 'Failed to reset password')
        } finally {
            setResetBusy(false)
        }
    }

    const openEnableLoginModal = (row: Row) => {
        setEnableLoginTarget(row)
        setEnableLoginForm({
            password: makeTemporaryPassword(),
            approved: true,
        })
        setEnableLoginBusy(false)
        setEnableLoginError(null)
    }

    const closeEnableLoginModal = () => {
        if (enableLoginBusy) return
        setEnableLoginTarget(null)
        setEnableLoginError(null)
    }

    const submitEnableLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!enableLoginTarget) return
        setEnableLoginError(null)
        if (!enableLoginForm.password || enableLoginForm.password.length < 6) {
            setEnableLoginError('Password must be at least 6 characters.')
            return
        }
        try {
            setEnableLoginBusy(true)
            const res = await fetch(`/api/admin/dealers/${enableLoginTarget.id}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(enableLoginForm),
            })
            const json = await res.json().catch(() => null)
            if (!res.ok) {
                throw new Error(json?.message || 'Failed to enable login')
            }
            await load()
            setEnableLoginTarget(null)
        } catch (err: any) {
            setEnableLoginError(err?.message || 'Failed to enable login')
        } finally {
            setEnableLoginBusy(false)
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

            {/* Create dealer */}
            <section className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,122,153,0.10)] p-4">
                <div className="mb-3">
                    <h2 className="text-lg font-extrabold text-slate-900">Create Dealer</h2>
                    <p className="text-sm text-slate-600">Create dealer account and login from admin portal.</p>
                </div>
                <form onSubmit={createDealer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                        value={createForm.name}
                        onChange={(e)=>setCreateForm(f=>({ ...f, name: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        placeholder="Dealer name"
                        required
                    />
                    <input
                        type="email"
                        value={createForm.email}
                        onChange={(e)=>setCreateForm(f=>({ ...f, email: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        placeholder="Email"
                        required
                    />
                    <input
                        type={createForm.createLogin ? 'password' : 'text'}
                        value={createForm.password}
                        onChange={(e)=>setCreateForm(f=>({ ...f, password: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        placeholder={createForm.createLogin ? 'Temporary password (min 6)' : 'No login will be created'}
                        required={createForm.createLogin}
                        disabled={!createForm.createLogin}
                    />
                    <input
                        value={createForm.phone}
                        onChange={(e)=>setCreateForm(f=>({ ...f, phone: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        placeholder="Phone"
                        required
                    />
                    <input
                        value={createForm.address}
                        onChange={(e)=>setCreateForm(f=>({ ...f, address: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm md:col-span-2 lg:col-span-2"
                        placeholder="Address"
                        required
                    />
                    <input
                        value={createForm.city}
                        onChange={(e)=>setCreateForm(f=>({ ...f, city: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        placeholder="City"
                        required
                    />
                    <select
                        value={createForm.state}
                        onChange={(e)=>setCreateForm(f=>({ ...f, state: e.target.value }))}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                        required
                    >
                        <option value="">State</option>
                        {STATES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={createForm.createLogin}
                            onChange={(e)=>setCreateForm(f=>({
                                ...f,
                                createLogin: e.target.checked,
                                password: e.target.checked ? (f.password || makeTemporaryPassword()) : '',
                            }))}
                        />
                        Create login now
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={createForm.approved}
                            onChange={(e)=>setCreateForm(f=>({ ...f, approved: e.target.checked }))}
                            disabled={!createForm.createLogin}
                        />
                        Approved for login
                    </label>
                    <div className="flex items-center justify-end lg:col-span-4">
                        <button
                            type="submit"
                            disabled={creating}
                            className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {creating ? 'Creating…' : 'Create Dealer'}
                        </button>
                    </div>
                    {createError ? (
                        <div className="lg:col-span-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                            {createError}
                        </div>
                    ) : null}
                    {createOk ? (
                        <div className="lg:col-span-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                            {createOk}
                        </div>
                    ) : null}
                </form>
            </section>

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
                                <div className="flex items-center gap-2">
                                    <div className="font-semibold text-slate-900">{r.name || '—'}</div>
                                    {!r.hasLogin ? (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                            No login
                                        </span>
                                    ) : null}
                                </div>
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
                                        onClick={() => (r.hasLogin ? toggleApproval(r as any) : openEnableLoginModal(r))}
                                        disabled={busyId === r.id}
                                        className={[
                                            'h-9 rounded-lg px-3 text-xs font-semibold border',
                                            !r.hasLogin
                                                ? 'border-amber-200 bg-white hover:bg-amber-50 text-amber-700'
                                                : r.approved
                                                ? 'border-rose-200 bg-white hover:bg-rose-50 text-rose-700'
                                                : 'border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-700'
                                        ].join(' ')}
                                        title={!r.hasLogin ? 'Create login for dealer' : r.approved ? 'Disable dealer' : 'Approve dealer'}
                                    >
                                        {busyId === r.id
                                            ? 'Saving…'
                                            : !r.hasLogin
                                                ? 'Enable login'
                                            : r.approved
                                                ? (<span className="inline-flex items-center gap-1"><XCircle size={14}/> Disable</span>)
                                                : (<span className="inline-flex items-center gap-1"><CheckCircle2 size={14}/> Approve</span>)
                                        }
                                    </button>
                                    <button
                                        onClick={() => openResetModal(r)}
                                        disabled={!r.hasLogin}
                                        className="h-9 rounded-lg px-3 text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1 disabled:opacity-40 disabled:hover:bg-white"
                                        title="Reset dealer password"
                                    >
                                        <KeyRound size={14} />
                                        Reset password
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

            {resetTarget ? (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-900">Reset Dealer Password</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    {resetTarget.name || 'Dealer'} ({resetTarget.email || 'No email'})
                                </p>
                            </div>
                            <button
                                onClick={closeResetModal}
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                aria-label="Close reset password dialog"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={submitResetPassword} className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                                <input
                                    type="text"
                                    value={resetForm.newPassword}
                                    onChange={(e)=>setResetForm(f=>({ ...f, newPassword: e.target.value }))}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                                    placeholder="New password (min 8)"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const temp = makeTemporaryPassword()
                                        setResetForm({ newPassword: temp, confirmPassword: temp })
                                        setResetError(null)
                                        setResetOk(null)
                                    }}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 justify-center"
                                >
                                    <RefreshCw size={14} />
                                    Generate
                                </button>
                            </div>
                            <input
                                type="text"
                                value={resetForm.confirmPassword}
                                onChange={(e)=>setResetForm(f=>({ ...f, confirmPassword: e.target.value }))}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                                placeholder="Confirm new password"
                                required
                            />
                            {resetError ? (
                                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                    {resetError}
                                </div>
                            ) : null}
                            {resetOk ? (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    {resetOk}
                                </div>
                            ) : null}
                            <div className="pt-1 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeResetModal}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetBusy}
                                    className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {resetBusy ? 'Saving…' : 'Save New Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {enableLoginTarget ? (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-extrabold text-slate-900">Enable Dealer Login</h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    {enableLoginTarget.name || 'Dealer'} ({enableLoginTarget.email || 'No email'})
                                </p>
                            </div>
                            <button
                                onClick={closeEnableLoginModal}
                                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                aria-label="Close enable login dialog"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={submitEnableLogin} className="mt-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                                <input
                                    type="text"
                                    value={enableLoginForm.password}
                                    onChange={(e)=>setEnableLoginForm(f=>({ ...f, password: e.target.value }))}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
                                    placeholder="Temporary password (min 6)"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setEnableLoginForm(f => ({ ...f, password: makeTemporaryPassword() }))}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1 justify-center"
                                >
                                    <RefreshCw size={14} />
                                    Generate
                                </button>
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={enableLoginForm.approved}
                                    onChange={(e)=>setEnableLoginForm(f=>({ ...f, approved: e.target.checked }))}
                                />
                                Approved for login
                            </label>
                            {enableLoginError ? (
                                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                    {enableLoginError}
                                </div>
                            ) : null}
                            <div className="pt-1 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeEnableLoginModal}
                                    className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Close
                                </button>
                                <button
                                    type="submit"
                                    disabled={enableLoginBusy}
                                    className="h-10 rounded-lg bg-black px-4 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    {enableLoginBusy ? 'Saving…' : 'Enable Login'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {/* Stripe */}
            <div
                className="h-1 w-full rounded-full"
                style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
            />
        </div>
    )
}
