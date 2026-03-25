// app/api/admin/orders/[id]/schedule/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AdminModule } from '@prisma/client'
import { parseDateOnlyToUtcNoon } from '@/lib/dateOnly'
import { assertFactoryAccess, requireAdminAccess } from '@/lib/adminAccess'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = (ctx as any).params
  return ('then' in p ? (await p).id : p.id) as string
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.PRODUCTION_SCHEDULE)

    const id = await getOrderId(ctx)
    const body = await req.json().catch(() => null)

    const priorityRaw = body?.productionPriority
    const shipRaw = body?.requestedShipDate
    const productionDateRaw = body?.scheduledProductionDate

    const productionPriority =
      priorityRaw === null || priorityRaw === '' || priorityRaw === undefined
        ? null
        : Math.max(1, Math.min(9999, Number(priorityRaw)))

    const requestedShipDate =
      shipRaw === null || shipRaw === '' || shipRaw === undefined
        ? null
        : parseDateOnlyToUtcNoon(String(shipRaw))

    const scheduledProductionDate =
      productionDateRaw === null || productionDateRaw === '' || productionDateRaw === undefined
        ? null
        : new Date(String(productionDateRaw))

    if (shipRaw !== null && shipRaw !== '' && shipRaw !== undefined && !requestedShipDate) {
      return NextResponse.json({ message: 'Invalid requestedShipDate' }, { status: 400 })
    }
    if (scheduledProductionDate && Number.isNaN(+scheduledProductionDate)) {
      return NextResponse.json({ message: 'Invalid scheduledProductionDate' }, { status: 400 })
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        select: { id: true, jobId: true, factoryLocationId: true },
      })
      if (!existing) throw new Error('Order not found')
      assertFactoryAccess(access, existing.factoryLocationId)

      const sharedSchedule = { productionPriority, requestedShipDate, scheduledProductionDate }

      if (existing.jobId) {
        await tx.order.updateMany({
          where: { jobId: existing.jobId },
          data: sharedSchedule,
        })
      } else {
        await tx.order.update({
          where: { id },
          data: sharedSchedule,
        })
      }

      return tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          productionPriority: true,
          requestedShipDate: true,
          scheduledProductionDate: true,
          serialNumber: true,
          createdAt: true,
          deliveryAddress: true,
          paymentProofUrl: true,
          poolModel: { select: { name: true } },
          color: { select: { name: true } },
          dealer: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      })
    })
    if (!updated) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/orders/[id]/schedule error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
