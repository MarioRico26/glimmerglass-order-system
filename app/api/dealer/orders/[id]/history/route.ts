import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { dealer: true },
  })

  if (!user?.dealer) {
    return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      dealer: { select: { id: true, name: true, email: true } },
      poolModel: { select: { name: true } },
      color: { select: { name: true } },
      factoryLocation: { select: { name: true } },
      histories: {
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  // Protege que el dealer solo vea sus propias órdenes
  if (!order || order.dealerId !== user.dealer.id) {
    return NextResponse.json({ message: 'Order not found or access denied' }, { status: 404 })
  }

  return NextResponse.json({
    order: {
      id: order.id,
      deliveryAddress: order.deliveryAddress,
      paymentProofUrl: order.paymentProofUrl,
      poolModel: order.poolModel,
      color: order.color,
      factory: order.factoryLocation,
      dealer: {
        name: order.dealer.name,
        email: order.dealer.email,
      },
      hardwareSkimmer: order.hardwareSkimmer,
      hardwareAutocover: order.hardwareAutocover,
      hardwareReturns: order.hardwareReturns,
      hardwareMainDrains: order.hardwareMainDrains,
    },
    history: order.histories,
  })
}