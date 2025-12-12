//glimmerglass-order-system/app/api/dealer/orders/[id]/history/route.ts:
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

  const history = await prisma.orderHistory.findMany({
    where: { order: { dealerId: user.dealer.id, id: params.id } },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(history)
}