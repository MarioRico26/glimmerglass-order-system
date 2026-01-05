// app/api/admin/orders/[id]/schedule/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getOrderId(ctx: Ctx) {
  const p: any = (ctx as any).params
  return ('then' in p ? (await p).id : p.id) as string
}

function isAdminRole(role: any) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (!isAdminRole(user.role)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const id = await getOrderId(ctx)
    const body = await req.json().catch(() => null)

    const priorityRaw = body?.productionPriority
    const shipRaw = body?.requestedShipDate

    const productionPriority =
      priorityRaw === null || priorityRaw === '' || priorityRaw === undefined
        ? null
        : Math.max(1, Math.min(9999, Number(priorityRaw)))

    const requestedShipDate =
      shipRaw === null || shipRaw === '' || shipRaw === undefined
        ? null
        : new Date(String(shipRaw))

    if (requestedShipDate && Number.isNaN(+requestedShipDate)) {
      return NextResponse.json({ message: 'Invalid requestedShipDate' }, { status: 400 })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { productionPriority, requestedShipDate },
      select: {
        id: true,
        status: true,
        productionPriority: true,
        requestedShipDate: true,
        createdAt: true,
        deliveryAddress: true,
        paymentProofUrl: true,
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        dealer: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      },
    })

    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/orders/[id]/schedule error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}