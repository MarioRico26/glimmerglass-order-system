// app/api/dealer/notifications/unread-count/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  if (!user || user.role !== 'DEALER' || !user.dealerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const count = await prisma.notification.count({
      where: { dealerId: user.dealerId, read: false },
    })
    return NextResponse.json({ count })
  } catch (e) {
    console.error('GET /api/dealer/notifications/unread-count error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}