//glimmerglass-order-system/app/api/admin/orders/[id]/history/route.ts:
// glimmerglass-order-system/app/api/admin/orders/[id]/history/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { createNotification } from '@/lib/createNotification'
import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@prisma/client'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

// Utilidad: Next puede pasar params como promesa en RSC
async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  const { id } = 'then' in p ? await p : p
  return id as string
}

function json(message: string, status = 400, extra?: Record<string, any>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

function isAdminRole(role: any) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

// GET: historial (admin)
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const orderId = await getOrderId(ctx)

    const history = await prisma.orderHistory.findMany({
      where: { orderId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(history, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/admin/orders/[id]/history error:', error)
    return json('Failed to fetch history', 500)
  }
}

// POST: crear NOTA manual (NO cambia estado) + notificar
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const orderId = await getOrderId(ctx)
    const body = await req.json().catch(() => ({} as any))

    // 🚫 Si mandan "status", rechazamos. Los cambios de status van por /status (con reglas).
    if (body?.status) {
      return json(
        'Status changes are not allowed from /history. Use /status endpoint.',
        400
      )
    }

    const comment = (body?.comment ?? '').toString().trim()
    if (!comment) return json('Comment is required', 400)

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    })
    if (!dbUser) return json('User not found', 404)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, dealerId: true, status: true },
    })
    if (!order) return json('Order not found', 404)

    const newHistory = await prisma.orderHistory.create({
      data: {
        orderId,
        status: order.status, // status actual, no inventado
        comment,
        userId: dbUser.id,
      },
      include: { user: { select: { email: true } } },
    })

    // Notificación (no rompe si falla)
    try {
      await createNotification({
        dealerId: order.dealerId,
        title: 'Order Note Added',
        message: comment.length > 120 ? `${comment.slice(0, 117)}...` : comment,
        orderId: order.id,
      })
    } catch {
      // silencioso
    }

    return NextResponse.json(newHistory, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: any) {
    console.error('POST /api/admin/orders/[id]/history error:', {
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    })
    return json('Internal server error', 500)
  }
}