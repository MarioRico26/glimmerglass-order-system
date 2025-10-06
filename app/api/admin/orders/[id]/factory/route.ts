// app/api/admin/orders/[id]/factory/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

// PATCH: cambiar la fábrica asignada a la orden
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const orderId = params.id
    const body = await req.json()
    const factoryLocationId = (body.factoryLocationId ?? '').toString()

    if (!factoryLocationId) {
      return NextResponse.json({ message: 'Missing factoryLocationId' }, { status: 400 })
    }

    // Validar orden y fábrica
    const [order, factory] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId } }),
      prisma.factoryLocation.findUnique({ where: { id: factoryLocationId } }),
    ])

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }
    if (!factory) {
      return NextResponse.json({ message: 'Factory not found' }, { status: 404 })
    }

    // Actualizar orden
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { factoryLocationId },
      include: {
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        dealer: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      },
    })

    return NextResponse.json({
      message: 'Factory updated successfully',
      order: {
        id: updated.id,
        deliveryAddress: updated.deliveryAddress,
        status: updated.status,
        poolModel: updated.poolModel,
        color: updated.color,
        dealer: updated.dealer,
        factory: updated.factoryLocation,
      },
    })
  } catch (err: any) {
    console.error('PATCH /factory error:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}