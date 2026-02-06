import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

const STATUSES = ['READY', 'RESERVED', 'IN_PRODUCTION', 'DAMAGED'] as const

export async function GET() {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const factories = await prisma.factoryLocation.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const groups = await prisma.poolStock.groupBy({
      by: ['factoryId', 'status'],
      _sum: { quantity: true },
    })

    const map = new Map(
      factories.map((f) => [
        f.id,
        {
          factoryId: f.id,
          factoryName: f.name,
          totals: {
            READY: 0,
            RESERVED: 0,
            IN_PRODUCTION: 0,
            DAMAGED: 0,
          } as Record<(typeof STATUSES)[number], number>,
        },
      ])
    )

    for (const row of groups) {
      const entry = map.get(row.factoryId)
      if (!entry) continue
      const status = row.status as (typeof STATUSES)[number]
      entry.totals[status] = row._sum.quantity || 0
    }

    return NextResponse.json({ items: Array.from(map.values()) })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Internal Server Error' },
      { status: e?.status ?? 500 }
    )
  }
}
