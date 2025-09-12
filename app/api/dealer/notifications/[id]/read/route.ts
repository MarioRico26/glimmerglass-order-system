// app/api/dealer/notifications/[id]/read/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function PATCH(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  const user = session?.user

  if (!user || user.role !== 'DEALER' || !user.dealerId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const exists = await prisma.notification.findFirst({
      where: { id: params.id, dealerId: user.dealerId },
      select: { id: true },
    })
    if (!exists) return NextResponse.json({ message: 'Not found' }, { status: 404 })

    await prisma.notification.update({
      where: { id: params.id },
      data: { read: true },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('PATCH /api/dealer/notifications/[id]/read error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}