// app/api/admin/orders/[id]/factory/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (
      !session?.user?.email ||
      (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')
    ) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.id
    const body = await req.json()

    const factoryLocationId =
      typeof body.factoryLocationId === 'string' && body.factoryLocationId.trim()
        ? body.factoryLocationId
        : null

    const shippingMethod =
      typeof body.shippingMethod === 'string' && body.shippingMethod.trim()
        ? body.shippingMethod
        : null

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        factoryLocationId,
        shippingMethod,
      },
      select: {
        id: true,
        deliveryAddress: true,
        status: true,
        paymentProofUrl: true,
        shippingMethod: true,
        hardwareSkimmer: true,
        hardwareReturns: true,
        hardwareAutocover: true,
        hardwareMainDrains: true,
        dealer: { select: { name: true } },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/admin/orders/[id]/factory error:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}