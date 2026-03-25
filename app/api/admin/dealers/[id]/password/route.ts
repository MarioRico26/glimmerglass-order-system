import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAccess(AdminModule.DEALERS)

    const dealerId = params?.id?.trim()
    if (!dealerId) {
      return NextResponse.json({ message: 'Invalid dealer id' }, { status: 400 })
    }

    const body = await req.json().catch(() => null) as { newPassword?: string } | null
    const newPassword = String(body?.newPassword || '')

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: 'Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const users = await prisma.user.findMany({
      where: { dealerId },
      select: { id: true },
    })
    if (!users.length) {
      return NextResponse.json({ message: 'Dealer has no linked users.' }, { status: 404 })
    }

    const userIds = users.map((u) => u.id)
    const passwordHash = await hash(newPassword, 12)

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { id: { in: userIds } },
        data: { password: passwordHash },
      })
      await tx.passwordResetToken.deleteMany({
        where: { userId: { in: userIds } },
      })
    })

    return NextResponse.json({ ok: true, updatedUsers: userIds.length }, { status: 200 })
  } catch (e) {
    console.error('PATCH /api/admin/dealers/[id]/password error:', e)
    const status = typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number' ? (e as any).status : 500
    const message = typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string' ? (e as any).message : 'Internal server error'
    return NextResponse.json({ message }, { status })
  }
}
