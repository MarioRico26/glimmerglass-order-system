//glimmerglass-order-system/app/api/admin/orders/[id]/shipping/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id
  const body = await req.json()
  const { shippingMethod } = body

  if (!['PICK_UP', 'QUOTE'].includes(shippingMethod)) {
    return NextResponse.json(
      { error: 'Invalid shipping method' },
      { status: 400 }
    )
  }

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingMethod,
      },
      include: {
        factoryLocation: true,
        dealer: true,
        poolModel: true,
        color: true,
      },
    })

    return NextResponse.json(updatedOrder)
  } catch (error) {
    console.error('Error updating shipping method:', error)
    return NextResponse.json(
      { error: 'Failed to update shipping method' },
      { status: 500 }
    )
  }
}