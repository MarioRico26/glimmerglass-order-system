// components/DealerNotificationsBell.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Notification = {
  id: string
  title: string
  message: string
  read: boolean
  createdAt: string
  // Hazlo tolerante: si existe en el backend lo usará; si no, undefined
  orderId?: string | null
}

export default function DealerNotificationsBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState<Notification[]>([])
  const pollingRef = useRef<number | null>(null)

  const fetchCount = async () => {
    try {
      const res = await fetch('/api/dealer/notifications/unread-count', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setCount(data.count ?? 0)
    } catch {}
  }

  const fetchList = async () => {
    try {
      const res = await fetch('/api/dealer/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data: Notification[] = await res.json()
      setItems(data)
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await fetch('/api/dealer/notifications/mark-read', { method: 'PATCH' })
      // Refrescar estado
      fetchCount()
      fetchList()
    } catch {}
  }

  useEffect(() => {
    // cargar al inicio
    fetchCount()
    // polling cada 30s
    pollingRef.current = window.setInterval(fetchCount, 30000)
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current)
    }
  }, [])

  // al abrir: cargar lista y marcar leídas
  useEffect(() => {
    if (!open) return
    const run = async () => {
      await fetchList()
      await markAllRead()
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 hover:bg-gray-100"
        aria-label="Notifications"
      >
        {/* campana simple en SVG */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.25 18.75a2.25 2.25 0 11-4.5 0m9-6v3.375c0 .621-.504 1.125-1.125 1.125H6.375A1.125 1.125 0 015.25 16.125V12a6.75 6.75 0 1113.5 0z" />
        </svg>

        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-xs flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[95vw] bg-white border rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No notifications found.</div>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-sm text-gray-700">{n.message}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                        {n.orderId ? (
                          <Link
                            href={`/dealer/orders/${n.orderId}/history`}
                            className="text-xs text-blue-600 underline mt-1 inline-block"
                          >
                            View order
                          </Link>
                        ) : null}
                      </div>
                      {!n.read && (
                        <span className="mt-1 inline-block w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}