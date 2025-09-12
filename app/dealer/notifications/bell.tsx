// app/dealer/notifications/bell.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Bell, Check, RefreshCw, ExternalLink } from 'lucide-react'

type Notification = {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  orderId?: string | null
}

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

export default function NotificationsBell() {
  const { data: session, status } = useSession()
  const role = (session as any)?.user?.role
  const dealerEnabled = status === 'authenticated' && role === 'DEALER'

  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const pollingRef = useRef<number | null>(null)

  const filtered = useMemo(
    () => (tab === 'all' ? items : items.filter(n => !n.read)),
    [items, tab]
  )

  const fetchCount = async () => {
    if (!dealerEnabled) return
    try {
      const res = await fetch('/api/dealer/notifications/unread-count', { cache: 'no-store' })
      if (!res.ok) { setCount(0); return } // silencio 401/403/…
      const data = await safeJson<{ count: number }>(res)
      setCount(data?.count ?? 0)
    } catch {
      setCount(0)
    }
  }

  const fetchList = async () => {
    if (!dealerEnabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dealer/notifications', { cache: 'no-store' })
      if (!res.ok) { setItems([]); setError(null); return } // no ruido
      const data = await safeJson<Notification[] | { items?: Notification[]; notifications?: Notification[] }>(res)
      const list =
        Array.isArray(data) ? data :
        Array.isArray((data as any)?.items) ? (data as any).items :
        Array.isArray((data as any)?.notifications) ? (data as any).notifications : []
      setItems(list)
    } catch {
      setItems([])
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const markAllRead = async () => {
    if (!dealerEnabled) return
    try { await fetch('/api/dealer/notifications/mark-read', { method: 'PATCH' }) } catch {}
    fetchCount()
    fetchList()
  }

  const markOneRead = async (id: string) => {
    if (!dealerEnabled) return
    try { await fetch(`/api/dealer/notifications/${id}/read`, { method: 'PATCH' }) } catch {}
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    setCount(prev => Math.max(0, prev - 1))
  }

  // start/stop polling solo cuando dealerEnabled
  useEffect(() => {
    if (!dealerEnabled) {
      if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null }
      setCount(0)
      return
    }
    fetchCount()
    pollingRef.current = window.setInterval(fetchCount, 30000)
    return () => {
      if (pollingRef.current) { window.clearInterval(pollingRef.current); pollingRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerEnabled])

  // abrir: carga lista (solo dealerEnabled)
  useEffect(() => {
    if (!open || !dealerEnabled) return
    fetchList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealerEnabled])

  // click-outside & ESC
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  // Si no es dealer o está cargando sesión, no renderizamos nada (evita flicker/pantallazo)
  if (status !== 'authenticated' || role !== 'DEALER') {
    return null
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="relative rounded-full p-2 hover:bg-white/70 transition shadow-sm border border-white"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-slate-700" />
        {count > 0 && (
          <>
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] leading-5 text-center shadow">
              {count > 99 ? '99+' : count}
            </span>
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-50" />
            </span>
          </>
        )}
      </button>

      {/* Popover */}
      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        className={[
          'absolute right-0 mt-2 w-[420px] max-w-[95vw] z-50',
          'transition transform origin-top-right',
          open ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-95',
        ].join(' ')}
      >
        <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Notifications</span>
              <div className="h-1 w-16 rounded-full" style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchList} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50" title="Refresh">
                <RefreshCw size={14} /> Refresh
              </button>
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50" title="Mark all as read">
                <Check size={14} /> Mark all
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-3 pt-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold w-fit">
              <button onClick={() => setTab('all')} className={['px-3 py-1 rounded-lg transition', tab === 'all' ? 'bg-white shadow' : 'text-slate-600'].join(' ')}>All</button>
              <button onClick={() => setTab('unread')} className={['px-3 py-1 rounded-lg transition', tab === 'unread' ? 'bg-white shadow' : 'text-slate-600'].join(' ')}>Unread</button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-auto p-3">
            {loading && (
              <ul className="space-y-3">
                {[...Array(4)].map((_, i) => <li key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
              </ul>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-600">No notifications {tab === 'unread' ? 'unread' : ''}.</div>
            )}

            {!loading && !error && filtered.length > 0 && (
              <ul className="divide-y">
                {filtered.map((n) => (
                  <li key={n.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-slate-900">{n.title}</div>
                          {!n.read && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">NEW</span>}
                        </div>
                        <div className="text-sm text-slate-700">{n.message}</div>
                        <div className="text-xs text-slate-500 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                        {n.orderId ? (
                          <Link href={`/dealer/orders/${n.orderId}/history`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 hover:underline mt-1" onClick={() => markOneRead(n.id)}>
                            View order <ExternalLink size={12} />
                          </Link>
                        ) : (
                          !n.read && <button onClick={() => markOneRead(n.id)} className="text-xs text-sky-700 hover:underline mt-1">Mark as read</button>
                        )}
                      </div>
                      {!n.read && <span className="mt-1 inline-block w-2 h-2 rounded-full bg-sky-500" />}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}