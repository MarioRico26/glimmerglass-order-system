'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Bell, RefreshCw, ExternalLink } from 'lucide-react'

type AlertItem = {
  id: string
  type: 'final-payment' | 'missing-serial' | 'unscheduled-production' | 'unscheduled-shipping'
  title: string
  message: string
  href: string
  createdAt: string
  tone: 'rose' | 'amber' | 'indigo' | 'violet'
}

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

export default function AdminAlertsBell() {
  const { data: session, status } = useSession()
  const role = (session as any)?.user?.role
  const adminEnabled = status === 'authenticated' && (role === 'ADMIN' || role === 'SUPERADMIN')

  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const pollingRef = useRef<number | null>(null)

  const count = items.length

  const fetchAlerts = async () => {
    if (!adminEnabled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/alerts', { cache: 'no-store' })
      if (res.status === 403) {
        setItems([])
        setError(null)
        return
      }
      if (!res.ok) {
        setItems([])
        setError('Could not load alerts')
        return
      }
      const data = await safeJson<{ items?: AlertItem[] }>(res)
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setItems([])
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!adminEnabled) {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      setItems([])
      return
    }
    fetchAlerts()
    pollingRef.current = window.setInterval(fetchAlerts, 30000)
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [adminEnabled])

  useEffect(() => {
    if (!open || !adminEnabled) return
    fetchAlerts()
  }, [open, adminEnabled])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const toneClass = useMemo(
    () => ({
      rose: 'border-rose-200 bg-rose-50 text-rose-900',
      amber: 'border-amber-200 bg-amber-50 text-amber-900',
      indigo: 'border-indigo-200 bg-indigo-50 text-indigo-900',
      violet: 'border-violet-200 bg-violet-50 text-violet-900',
    }),
    []
  )

  if (!adminEnabled) return null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 hover:bg-white/70 transition shadow-sm border border-white"
        aria-label="Operational alerts"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5 text-slate-700" />
        {count > 0 ? (
          <>
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] leading-5 text-center shadow">
              {count > 99 ? '99+' : count}
            </span>
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-50" />
            </span>
          </>
        ) : null}
      </button>

      <div
        ref={popRef}
        role="dialog"
        aria-modal="true"
        className={[
          'absolute right-0 mt-2 w-[440px] max-w-[95vw] z-50 transition transform origin-top-right',
          open ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-95',
        ].join(' ')}
      >
        <div className="rounded-2xl border border-white bg-white/86 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <div className="font-semibold text-slate-900">Operational Alerts</div>
              <div className="text-xs text-slate-500">Live issues that need operational follow-up.</div>
            </div>
            <button
              onClick={fetchAlerts}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
              title="Refresh alerts"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="max-h-[28rem] overflow-auto p-3">
            {loading ? (
              <ul className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <li key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </ul>
            ) : error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-600">No operational alerts right now.</div>
            ) : (
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass[item.tone]}`}>
                            {item.title}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-slate-800">{item.message}</div>
                        <div className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
                        <Link
                          href={item.href}
                          className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-slate-800 hover:underline"
                          onClick={() => setOpen(false)}
                        >
                          Open <ExternalLink size={12} />
                        </Link>
                      </div>
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
