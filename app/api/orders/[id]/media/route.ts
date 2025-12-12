// glimmerglass-order-system/app/api/orders/[id]/media/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

function json(message: string, status = 400) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.email) return json('Unauthorized', 401)
    if (user.role !== Role.DEALER) return json('Forbidden', 403)

    // Load user -> dealer
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { dealer: true },
    })

    if (!dbUser?.dealer) return json('Dealer not found for this user', 403)

    const orderId = params.id

    // Verify order belongs to this dealer
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, dealerId: true },
    })

    if (!order) return json('Order not found', 404)
    if (order.dealerId !== dbUser.dealer.id) return json('Forbidden', 403)

    // Return only dealer-visible docs
    const items = await prisma.orderMedia.findMany({
      where: {
        orderId,
        visibleToDealer: true,
      },
      orderBy: { uploadedAt: 'desc' },
      select: {
        id: true,
        fileUrl: true,
        type: true, // MediaType (photo/proof/update/note)
        docType: true, // OrderDocType (WARRANTY/MANUAL/etc)
        uploadedAt: true,
      },
    })

    return NextResponse.json(items, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/orders/[id]/media error:', e)
    return json('Failed to fetch media', 500)
  }
}