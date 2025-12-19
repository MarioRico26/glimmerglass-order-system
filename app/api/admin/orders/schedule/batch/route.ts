// app/api/admin/orders/schedule/batch/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { Role } from '@prisma/client'

function isAdminRole(role: any) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    if (!isAdminRole(user.role)) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => null)
    const updates = body?.updates as Array<{ id: string; productionPriority: number | null }> | undefined

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ message: 'Missing updates[]' }, { status: 400 })
    }

    // Sanitiza
    const clean = updates
      .filter(u => typeof u?.id === 'string' && u.id.length > 5)
      .map(u => ({
        id: u.id,
        productionPriority:
          u.productionPriority === null ? null : Math.max(1, Math.min(9999, Number(u.productionPriority))),
      }))

    await prisma.$transaction(
      clean.map(u =>
        prisma.order.update({
          where: { id: u.id },
          data: { productionPriority: u.productionPriority },
          select: { id: true },
        })
      )
    )

    return NextResponse.json({ ok: true, updated: clean.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/orders/schedule/batch error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}