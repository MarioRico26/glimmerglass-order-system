// app/api/admin/metrics/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

type Status =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'APPROVED'
  | 'IN_PRODUCTION'
  | 'COMPLETED'
  | 'CANCELED'

const STATUSES: Status[] = [
  'PENDING_PAYMENT_APPROVAL',
  'APPROVED',
  'IN_PRODUCTION',
  'COMPLETED',
  // 'CANCELED' // <- si no la quieres en los cards, déjala fuera
]

export async function GET() {
  try {
    // Solo ADMIN / SUPERADMIN
    await requireRole(['ADMIN', 'SUPERADMIN'])

    // --- Totales por estatus ---
    const groupByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    })

    const totals: Record<string, number> = { total: 0 }
    for (const s of STATUSES) totals[s] = 0

    for (const row of groupByStatus) {
      const st = row.status as Status
      const c = row._count._all
      totals.total += c
      if (st in totals) totals[st] += c
    }

    // --- Últimos 6 meses (incluye meses sin órdenes con count=0) ---
    const now = new Date()
    const monthly: { key: string; label: string; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(now, i))
      const end = endOfMonth(subMonths(now, i))
      const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
      const label = start.toLocaleDateString(undefined, { month: 'short' })

      const count = await prisma.order.count({
        where: { createdAt: { gte: start, lte: end } },
      })

      monthly.push({ key, label, count })
    }

    // --- Órdenes recientes (incluye dealer/model/color/factoryLocation) ---
    const recentRaw = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        dealer: { select: { name: true } },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        // ⚠️ Si tu relación se llama distinto (ej. "factory"), ajusta aquí y en el map:
        factoryLocation: { select: { name: true } },
      },
    })

    const recent = recentRaw.map((o) => ({
      id: o.id,
      dealer: o.dealer?.name ?? '—',
      model: o.poolModel?.name ?? '—',
      color: o.color?.name ?? '—',
      // 👇 normalizamos al campo "factory" que consume el frontend
      factory: o.factoryLocation?.name ?? 'Unknown Factory',
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    }))

    // --- Totales por fábrica (incluye fábricas sin órdenes) ---
    const factories = await prisma.factoryLocation.findMany({
      select: { id: true, name: true },
    })

    // Agrupamos por factoryLocationId + status
    const perFactory = await prisma.order.groupBy({
      by: ['factoryLocationId', 'status'],
      _count: { _all: true },
    })

    // Mapa base con todas las fábricas
    const byFactoryMap = new Map<
      string,
      { factoryId: string; factoryName: string; totals: Record<string, number> }
    >()

    for (const f of factories) {
      const base: Record<string, number> = { total: 0 }
      for (const s of STATUSES) base[s] = 0
      byFactoryMap.set(f.id, { factoryId: f.id, factoryName: f.name, totals: base })
    }

    // Sumamos los conteos
    for (const row of perFactory) {
      const fId = row.factoryLocationId
      if (!fId) continue
      const entry = byFactoryMap.get(fId)
      if (!entry) continue
      const st = row.status as Status
      const c = row._count._all
      entry.totals.total += c
      if (st in entry.totals) entry.totals[st] += c
    }

    // Ordenamos alfabéticamente por nombre de fábrica
    const byFactory = Array.from(byFactoryMap.values()).sort((a, b) =>
      a.factoryName.localeCompare(b.factoryName),
    )

    return NextResponse.json(
      {
        totals,
        monthly,
        recent,
        byFactory,
      },
      { status: 200 },
    )
  } catch (e: any) {
    console.error('GET /api/admin/metrics error:', e)
    const status = e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}