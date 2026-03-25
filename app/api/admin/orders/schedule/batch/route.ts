// app/api/admin/orders/schedule/batch/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AdminModule } from '@prisma/client'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireAdminAccess(AdminModule.PRODUCTION_SCHEDULE)

    const body = await req.json().catch(() => null) as
      | { updates?: Array<{ id?: unknown; productionPriority?: unknown }> }
      | null
    const updates = body?.updates

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ message: 'Missing updates[]' }, { status: 400 })
    }

    const seen = new Set<string>()
    const clean = updates
      .filter((u) => typeof u?.id === 'string' && u.id.length > 5 && !seen.has(u.id))
      .map((u) => {
        seen.add(u.id as string)
        const raw = u.productionPriority
        const parsed =
          raw === null || raw === undefined || raw === ''
            ? null
            : Math.max(1, Math.min(9999, Math.round(Number(raw))))
        return {
          id: u.id as string,
          productionPriority: Number.isFinite(parsed as number) || parsed === null ? parsed : null,
        }
      })

    if (clean.length === 0) {
      return NextResponse.json({ message: 'No valid updates' }, { status: 400 })
    }

    const existing = await prisma.order.findMany({
      where: { id: { in: clean.map((u) => u.id) } },
      select: { id: true, status: true, factoryLocationId: true },
    })
    const existingMap = new Map(existing.map((o) => [o.id, o.status] as const))
    const outOfScopeIds =
      access.allowedFactoryIds === null
        ? []
        : existing
            .filter((o) => !o.factoryLocationId || !access.allowedFactoryIds.includes(o.factoryLocationId))
            .map((o) => o.id)
    if (outOfScopeIds.length > 0) {
      return NextResponse.json(
        { message: 'Some orders are outside your factory scope', outOfScopeIds },
        { status: 403 }
      )
    }

    const missingIds = clean.map((u) => u.id).filter((id) => !existingMap.has(id))
    if (missingIds.length > 0) {
      return NextResponse.json(
        { message: 'Some orders were not found', missingIds },
        { status: 400 }
      )
    }

    const allowedStatuses = new Set(['APPROVED', 'IN_PRODUCTION'])
    const invalidStatusIds = clean
      .map((u) => u.id)
      .filter((id) => !allowedStatuses.has(existingMap.get(id) as string))
    if (invalidStatusIds.length > 0) {
      return NextResponse.json(
        {
          message: 'Only in-production orders can be re-prioritized in Production Schedule',
          invalidStatusIds,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(
      clean.map((u) =>
        prisma.order.update({
          where: { id: u.id },
          data: { productionPriority: u.productionPriority },
          select: { id: true },
        })
      )
    )

    return NextResponse.json({ ok: true, updated: clean.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/orders/schedule/batch error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
