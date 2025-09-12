// app/api/dealer/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user

  if (!user || user.role !== 'DEALER' || !user.dealerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') || '1')
  const pageSize = Math.min(Number(searchParams.get('pageSize') || '20'), 100)
  const skip = (page - 1) * pageSize

  try {
    const items = await prisma.notification.findMany({
      where: { dealerId: user.dealerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
        orderId: true,
      },
    })

    // Array directo
    return NextResponse.json(
      items.map(n => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      }))
    )
  } catch (e) {
    console.error('GET /api/dealer/notifications error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}