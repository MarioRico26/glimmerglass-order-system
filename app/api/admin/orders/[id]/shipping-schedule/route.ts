export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AdminModule } from '@prisma/client'
import { assertFactoryAccess, requireAdminAccess } from '@/lib/adminAccess'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = (ctx as any).params
  return ('then' in p ? (await p).id : p.id) as string
}

function parseScheduledShipDate(input: unknown) {
  if (input === null || input === undefined || input === '') return null
  const raw = String(input).trim()
  if (!raw) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00.000Z` : raw
  const parsed = new Date(normalized)
  return Number.isNaN(+parsed) ? 'INVALID' : parsed
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.SHIP_SCHEDULE)

    const id = await getOrderId(ctx)
    const body = await req.json().catch(() => null)

    const parsedDate = parseScheduledShipDate(body?.scheduledShipDate)
    if (parsedDate === 'INVALID') {
      return NextResponse.json({ message: 'Invalid scheduledShipDate' }, { status: 400 })
    }

    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, jobId: true, factoryLocationId: true },
    })

    if (!existing) return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    assertFactoryAccess(access, existing.factoryLocationId)
    if (existing.status !== 'PRE_SHIPPING') {
      return NextResponse.json(
        { message: 'Only pre-shipping orders can be scheduled for shipping' },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (existing.jobId) {
        await tx.order.updateMany({
          where: { jobId: existing.jobId },
          data: { scheduledShipDate: parsedDate },
        })
      } else {
        await tx.order.update({
          where: { id },
          data: { scheduledShipDate: parsedDate },
        })
      }

      return tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          requestedShipDate: true,
          scheduledShipDate: true,
          shippingMethod: true,
          serialNumber: true,
          createdAt: true,
          deliveryAddress: true,
          poolModel: { select: { name: true } },
          color: { select: { name: true } },
          dealer: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      })
    })
    if (!updated) return NextResponse.json({ message: 'Order not found' }, { status: 404 })

    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/orders/[id]/shipping-schedule error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
