// app/api/dealer/notifications/mark-read/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function PATCH() {
  const session = await getServerSession(authOptions)
  const user = session?.user

  if (!user || user.role !== 'DEALER' || !user.dealerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { dealerId: user.dealerId, read: false },
      data: { read: true },
    })
    return NextResponse.json({ updated: result.count })
  } catch (e) {
    console.error('PATCH /api/dealer/notifications/mark-read error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}