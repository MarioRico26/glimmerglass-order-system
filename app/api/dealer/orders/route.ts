// app/api/dealer/orders/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { normalizeOrderStatus } from '@/lib/orderFlow'

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'DEALER') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { dealer: true },
    })
    if (!user?.dealer) {
      return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
    }

    const orders = await prisma.order.findMany({
      where: { dealerId: user.dealer.id },
      include: { poolModel: true, color: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        status: normalizeOrderStatus(order.status)?.toString() ?? order.status,
      })),
    })
  } catch (error) {
    console.error('❌ Error fetching dealer orders:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
