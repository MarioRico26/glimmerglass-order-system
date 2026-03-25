import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ADMIN_MODULE_VALUES, requireAdminAccess } from '@/lib/adminAccess'

type PoolStockStatus = 'READY' | 'RESERVED' | 'IN_PRODUCTION' | 'DAMAGED'

function parseModule(raw: string | null): AdminModule | undefined {
  if (!raw) return undefined
  return ADMIN_MODULE_VALUES.includes(raw as AdminModule) ? (raw as AdminModule) : undefined
}

export async function GET(request: NextRequest) {
  try {
    const module = parseModule(request.nextUrl.searchParams.get('scopeModule'))
    const access = await requireAdminAccess(module)
    const factoryScope =
      access.allowedFactoryIds === null ? {} : { id: { in: access.allowedFactoryIds } }
    const stockScope =
      access.allowedFactoryIds === null ? {} : { factoryId: { in: access.allowedFactoryIds } }

    const factories = await prisma.factoryLocation.findMany({
      where: { active: true, ...factoryScope },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    const groups = await prisma.poolStock.groupBy({
      by: ['factoryId', 'status'],
      _sum: { quantity: true },
      where: stockScope,
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
          } as Record<PoolStockStatus, number>,
        },
      ])
    )

    for (const row of groups) {
      const entry = map.get(row.factoryId)
      if (!entry) continue
      const status = row.status as PoolStockStatus
      entry.totals[status] = row._sum.quantity || 0
    }

    return NextResponse.json({ items: Array.from(map.values()) })
  } catch (e: unknown) {
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof e.message === 'string'
        ? e.message
        : 'Internal Server Error'
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number'
        ? e.status
        : 500
    return NextResponse.json(
      { message },
      { status }
    )
  }
}
