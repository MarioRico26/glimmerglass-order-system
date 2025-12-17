// glimmerglass-order-system/app/api/admin/orders/[id]/history/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createNotification } from '@/lib/createNotification'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

async function getOrderId(context: Ctx) {
  const p: any = context.params
  const { id } = 'then' in p ? await p : p
  return id as string
}

export async function GET(_req: NextRequest, context: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
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

// POST: note only. Status changes MUST go through /status.
export async function POST(req: NextRequest, context: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email
    if (!userEmail) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const orderId = await getOrderId(context)
    const body = await req.json().catch(() => ({} as any))

    if (body?.status) {
      return NextResponse.json(
        { message: 'Status changes are not allowed from /history. Use /status endpoint.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const comment = (body?.comment ?? '').toString().trim()
    if (!comment) {
      return NextResponse.json(
        { message: 'Comment is required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const user = await prisma.user.findUnique({ where: { email: userEmail } })
    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, dealerId: true, status: true },
    })
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const newHistory = await prisma.orderHistory.create({
      data: {
        orderId,
        status: order.status, // keep current status
        comment,
        userId: user.id,
      },
      include: { user: { select: { email: true } } },
    })

    try {
      await createNotification({
        dealerId: order.dealerId,
        title: 'Order Note Added',
        message: comment.length > 120 ? `${comment.slice(0, 117)}...` : comment,
        orderId: order.id,
      })
    } catch {
      // ignore
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