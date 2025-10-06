// app/api/admin/orders/[id]/shipping/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

// PATCH: actualizar shippingMethod
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
    const shippingMethod = body.shippingMethod?.toString()

    if (!shippingMethod || !['PICK_UP', 'QUOTE'].includes(shippingMethod)) {
      return NextResponse.json({ message: 'Invalid or missing shipping method' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { shippingMethod },
    })

    return NextResponse.json({
      message: 'Shipping method updated successfully',
      order: {
        id: updated.id,
        shippingMethod: updated.shippingMethod,
      },
    })
  } catch (err: any) {
    console.error('PATCH /shipping error:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}