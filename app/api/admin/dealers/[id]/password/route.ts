import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { hash } from 'bcryptjs'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

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

  try {
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
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

