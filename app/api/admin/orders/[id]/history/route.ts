//glimmerglass-order-system/app/api/admin/orders/[id]/history/route.ts:
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions' // ← usa el mismo import que en el resto del proyecto
import { createNotification } from '@/lib/createNotification'
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_STATUSES = [
  'PENDING_PAYMENT_APPROVAL',
  'APPROVED',
  'IN_PRODUCTION',
  'COMPLETED',
  'CANCELED',
] as const
type AllowedStatus = typeof ALLOWED_STATUSES[number]

// Utilidad: Next puede pasar params como promesa en RSC
async function getOrderId(
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  const p: any = context.params
  const { id } = 'then' in p ? await p : p
  return id as string
}

// GET: historial de la orden
export async function GET(
  _req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(context)

    const history = await prisma.orderHistory.findMany({
      where: { orderId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /history error:', error)
    return NextResponse.json(
      { message: 'Failed to fetch history' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

// POST: crear entrada manual + actualizar estado del pedido + notificar
export async function POST(
  req: NextRequest,
  context: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email
    if (!userEmail) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }

    const orderId = await getOrderId(context)
    const body = await req.json()
    const status = (body.status ?? '').toString().trim().toUpperCase() as AllowedStatus
    const comment = (body.comment ?? '').toString()

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const user = await prisma.user.findUnique({ where: { email: userEmail } })
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, dealerId: true },
    })
    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    // Transacción: actualizar estado + crear historial
    const newHistory = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status },
      })

      const created = await tx.orderHistory.create({
        data: {
          orderId,
          status,
          comment,
          userId: user.id,
        },
        include: { user: { select: { email: true } } },
      })

      return created
    })

    // Notificación (no rompe si falla)
    try {
      await createNotification({
        dealerId: order.dealerId,
        title: 'Order Status Updated',
        message: `Status manually changed to ${status.replace(/_/g, ' ')}`,
        orderId: order.id,
      })
    } catch {
      // silencioso
    }

    return NextResponse.json(newHistory, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    console.error('POST /history error:', {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    })
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}