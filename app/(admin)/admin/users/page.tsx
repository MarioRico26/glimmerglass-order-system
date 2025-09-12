'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  UserPlus,
  Trash2,
  KeyRound,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'

type Role = 'ADMIN' | 'SUPERADMIN' | 'DEALER'

type UserRow = {
  id: string
  email: string
  role: Role
  approved: boolean
  dealerId?: string | null
}

type SortKey = 'email' | 'role' | 'approved'
type SortDir = 'asc' | 'desc'

const aqua = '#00B2CA'
const deep = '#007A99'

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

function Badge({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode
  tone?: 'green' | 'red' | 'blue' | 'slate' | 'amber' | 'purple'
}) {
  const map: Record<string, string> = {
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-800',
    purple: 'bg-purple-100 text-purple-800',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  )
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // filters
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')
  const [approvedFilter, setApprovedFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL')

  // sorting
  const [sortKey, setSortKey] = useState<SortKey>('email')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // create form
  const [form, setForm] = useState({
    email: '',
    password: '',
    role: 'ADMIN' as Role,
    approved: true,
  })

  // reset password modal
  const [pwUser, setPwUser] = useState<UserRow | null>(null)
  const [newPw, setNewPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/users', { cache: 'no-store' })
      const data = await safeJson<{ users: UserRow[]; message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || `Failed (${res.status})`)
      setUsers(data?.users || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      setError('Email y password son requeridos')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || 'Error creating user')
      setForm({ email: '', password: '', role: 'ADMIN', approved: true })
      await load()
    } catch (e: any) {
      setError(e?.message || 'Error creating user')
    } finally {
      setBusy(false)
    }
  }

  const toggleApproved = async (id: string, approved: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, approved }),
      })
      const data = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || 'Error updating approval')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Error updating approval')
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (id: string, role: Role) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      })
      const data = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || 'Error updating role')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Error updating role')
    } finally {
      setBusy(false)
    }
  }

  const removeUser = async (id: string) => {
    if (!confirm('Delete this user?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || 'Error deleting user')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Error deleting user')
    } finally {
      setBusy(false)
    }
  }

  const savePassword = async () => {
    if (!pwUser || !newPw) return
    setPwSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pwUser.id, password: newPw }),
      })
      const data = await safeJson<{ message?: string }>(res)
      if (!res.ok) throw new Error(data?.message || 'Error updating password')
      setPwUser(null)
      setNewPw('')
    } catch (e: any) {
      setError(e?.message || 'Error updating password')
    } finally {
      setPwSaving(false)
    }
  }

  // ---- Derived: Filtering & Sorting ----
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (approvedFilter === 'YES' && !u.approved) return false
      if (approvedFilter === 'NO' && u.approved) return false
      if (!ql) return true
      const hay = [u.email, u.role, u.dealerId ?? ''].join(' ').toLowerCase()
      return hay.includes(ql)
    })
  }, [users, q, roleFilter, approvedFilter])

  const sorted = useMemo(() => {
    const list = [...filtered]
    list.sort((a, b) => {
      let va: string | number | boolean = a[sortKey]
      let vb: string | number | boolean = b[sortKey]
      if (sortKey === 'email') {
        va = (a.email || '').toLowerCase()
        vb = (b.email || '').toLowerCase()
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [filtered, sortKey, sortDir])

  // ---- Stats ----
  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter((u) => u.role === 'ADMIN').length
    const supers = users.filter((u) => u.role === 'SUPERADMIN').length
    const dealers = users.filter((u) => u.role === 'DEALER').length
    const approved = users.filter((u) => u.approved).length
    const pending = total - approved
    return { total, admins, supers, dealers, approved, pending }
  }, [users])

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => {
    const active = sortKey === k
    const nextDir: SortDir =
      active ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc'
    return (
      <button
        onClick={() => {
          setSortKey(k)
          setSortDir(nextDir)
        }}
        className={`inline-flex items-center gap-1 text-left ${
          active ? 'text-slate-900 font-semibold' : 'text-slate-600'
        }`}
        title="Sort"
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        ) : null}
      </button>
    )
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Users (SUPERADMIN)</h1>
            <p className="text-slate-600">Create, filter, sort and manage user access</p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Stats */}
        <div className="grid sm:grid-cols-6 gap-3 mt-4">
          <div className="rounded-xl border border-white bg-white/80 p-3 shadow">
            <div className="text-slate-600 text-xs">Total</div>
            <div className="text-2xl font-black">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-white bg-white/80 p-3 shadow">
            <div className="text-slate-600 text-xs">Admins</div>
            <div className="text-2xl font-black">{stats.admins}</div>
          </div>
          <div className="rounded-xl border border-white bg-white/80 p-3 shadow">
            <div className="text-slate-600 text-xs">Superadmins</div>
            <div className="text-2xl font-black">{stats.supers}</div>
          </div>
          <div className="rounded-xl border border-white bg-white/80 p-3 shadow">
            <div className="text-slate-600 text-xs">Dealers</div>
            <div className="text-2xl font-black">{stats.dealers}</div>
          </div>
          <div className="rounded-xl border border-white bg-white/80 p-3 shadow">
            <div className="text-slate-600 text-xs">Approved</div>
            <div className="text-2xl font-black text-green-700">{stats.approved}</div>
          </div>
          <div className="rounded-xl border border-white bg-white/80 p-3 shadow">
            <div className="text-slate-600 text-xs">Pending</div>
            <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
          </div>
        </div>
      </div>

      {/* Create form */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-5">
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <UserPlus size={18} /> Create new user
        </h2>
        <form onSubmit={createUser} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Email</label>
            <input
              className="border border-slate-200 bg-white rounded-xl px-3 h-10 min-w-[240px]"
              placeholder="name@example.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Password</label>
            <input
              className="border border-slate-200 bg-white rounded-xl px-3 h-10 min-w-[180px]"
              placeholder="••••••••"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
            <div className="text-[11px] text-slate-500 mt-1">
              {form.password.length < 8
                ? 'Min 8 chars recommended'
                : 'Looks good'}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-600">Role</label>
            <select
              className="border border-slate-200 bg-white rounded-xl px-3 h-10"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
              <option value="DEALER" disabled>DEALER (se crea por registro)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={form.approved}
              onChange={(e) => setForm((f) => ({ ...f, approved: e.target.checked }))}
            />
            <span className="text-sm">Approved</span>
          </label>
          <button
            disabled={busy}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 h-10 rounded-xl shadow disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {busy ? 'Saving…' : 'Create'}
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email / role / dealerId"
              className="pl-8 pr-3 h-10 rounded-xl border border-slate-200 bg-white w-72 max-w-[85vw]"
            />
          </div>
          <Filter size={16} className="text-slate-500" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3"
          >
            <option value="ALL">All roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
            <option value="DEALER">DEALER</option>
          </select>
          <select
            value={approvedFilter}
            onChange={(e) => setApprovedFilter(e.target.value as any)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3"
          >
            <option value="ALL">All statuses</option>
            <option value="YES">Approved</option>
            <option value="NO">Pending</option>
          </select>
        </div>
      </div>

      {/* Errors */}
      {error && (
        <div className="mb-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] overflow-x-auto">
        {loading ? (
          <div className="p-4 text-slate-600">Loading users…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-slate-600 bg-slate-50">
              <tr>
                <th className="text-left py-2 px-3"><SortBtn k="email" label="Email" /></th>
                <th className="text-left py-2 px-3"><SortBtn k="role" label="Role" /></th>
                <th className="text-left py-2 px-3"><SortBtn k="approved" label="Status" /></th>
                <th className="text-left py-2 px-3">Dealer Link</th>
                <th className="text-left py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500">
                    No users match your filters.
                  </td>
                </tr>
              ) : (
                sorted.map((u, idx) => (
                  <tr key={u.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                    <td className="border-t py-2 px-3 font-medium">{u.email}</td>
                    <td className="border-t py-2 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as Role)}
                        className="border border-slate-200 bg-white rounded-lg px-2 py-1"
                        disabled={busy}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPERADMIN">SUPERADMIN</option>
                        <option value="DEALER">DEALER</option>
                      </select>
                    </td>
                    <td className="border-t py-2 px-3">
                      {u.approved ? (
                        <Badge tone="green">Approved</Badge>
                      ) : (
                        <Badge tone="amber">Pending</Badge>
                      )}
                    </td>
                    <td className="border-t py-2 px-3">{u.dealerId ?? '—'}</td>
                    <td className="border-t py-2 px-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() => toggleApproved(u.id, !u.approved)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded ${
                            u.approved
                              ? 'bg-red-100 text-red-800 hover:bg-red-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                          title={u.approved ? 'Disable' : 'Enable'}
                        >
                          {u.approved ? <XCircle size={14} /> : <ShieldCheck size={14} />}
                          {u.approved ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => setPwUser(u)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                          title="Reset password"
                        >
                          <KeyRound size={14} /> Reset PW
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => removeUser(u.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-800 hover:bg-slate-200"
                          title="Delete user"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Reset password modal */}
      {pwUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <KeyRound size={18} /> Reset password
            </h3>
            <p className="text-sm text-slate-600 mb-3">User: <span className="font-semibold">{pwUser.email}</span></p>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="New password"
              className="w-full border border-slate-200 bg-white rounded-xl px-3 h-10"
            />
            <div className="text-[11px] text-slate-500 mt-1 mb-4">
              Min 8 chars recommended, mix letters and numbers.
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-3 h-10 rounded-xl border border-slate-200 hover:bg-slate-50"
                onClick={() => { setPwUser(null); setNewPw('') }}
              >
                Cancel
              </button>
              <button
                disabled={!newPw || pwSaving}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 h-10 rounded-xl disabled:opacity-50"
                onClick={savePassword}
              >
                <Shield size={16} /> {pwSaving ? 'Saving…' : 'Save'}
              </button>
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