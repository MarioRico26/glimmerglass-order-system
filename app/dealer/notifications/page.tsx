// app/dealer/notifications/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, ExternalLink, RefreshCw, Inbox } from 'lucide-react'

type Notification = {
  id: string
  title: string
  message: string
  createdAt: string
  read?: boolean
  orderId?: string | null
}

const aqua = '#00B2CA'
const deep = '#007A99'

async function safeJson<T>(res: Response): Promise<T | null> {
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

export default function DealerNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dealer/notifications', { cache: 'no-store' })
      if (!res.ok) {
        const data = await safeJson<{ message?: string }>(res)
        throw new Error(data?.message || `Failed to load (${res.status})`)
      }
      const data =
        (await safeJson<Notification[] | { notifications: Notification[] }>(res)) || []
      const list = Array.isArray(data) ? data : (data as any).notifications || []
      setItems(list)
    } catch (e: any) {
      setItems([])
      setError(e?.message || 'Network error while loading notifications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const markRead = async (id: string) => {
    try {
      // si tienes endpoint: /api/dealer/notifications/[id]/read
      await fetch(`/api/dealer/notifications/${id}/read`, { method: 'PATCH' })
    } catch {}
    load()
  }

  const markAllRead = async () => {
    try {
      // si tienes endpoint: /api/dealer/notifications/read-all
      await fetch('/api/dealer/notifications/mark-read', { method: 'PATCH' })
    } catch {}
    load()
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Notifications</h1>
          <p className="text-slate-600">Updates related to your orders.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllRead}
            className="hidden sm:inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50"
            title="Mark all as read"
          >
            <Check size={16} /> Mark all
          </button>
          <button
            onClick={load}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-900">Inbox</h3>
          <div
            className="h-1 w-24 rounded-full"
            style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
          />
        </div>

        {loading && (
          <ul className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <li key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </ul>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 text-rose-700 px-3 py-2 inline-flex items-center gap-2">
            <Bell size={18} />
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-slate-600">
            <div className="rounded-full p-3 bg-slate-100 mb-3">
              <Inbox size={24} className="text-slate-500" />
            </div>
            <div className="font-semibold">You’re all caught up</div>
            <div className="text-sm">No notifications found.</div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((n) => {
              const orderHref = n.orderId ? `/dealer/orders/${n.orderId}/history` : null
              return (
                <li
                  key={n.id}
                  className={[
                    'rounded-xl border bg-white p-4 transition shadow-sm hover:shadow-md',
                    n.read ? 'border-slate-200' : 'border-sky-200 ring-1 ring-sky-100',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full p-2 bg-slate-100">
                        <Bell size={18} className="text-slate-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{n.title}</p>
                          {!n.read && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-slate-700 mt-1">{n.message}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                        {orderHref && (
                          <Link
                            href={orderHref}
                            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-800 hover:underline"
                          >
                            View order <ExternalLink size={14} />
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold hover:bg-slate-50"
                          title="Mark as read"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div
        className="mt-8 h-1 w-full rounded-full"
        style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
      />
    </div>
  )
}