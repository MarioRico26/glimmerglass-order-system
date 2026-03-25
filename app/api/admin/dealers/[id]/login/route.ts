import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAccess(AdminModule.DEALERS)

    const dealerId = params?.id?.trim()
    if (!dealerId) {
      return NextResponse.json({ message: 'Invalid dealer id' }, { status: 400 })
    }

    const body = await req.json().catch(() => null) as { password?: string; approved?: boolean } | null
    const password = String(body?.password || '')
    const approved = body?.approved === undefined ? true : Boolean(body.approved)

    if (password.length < 6) {
      return NextResponse.json({ message: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { id: true, email: true },
    })
    if (!dealer) {
      return NextResponse.json({ message: 'Dealer not found.' }, { status: 404 })
    }

    const existingByDealer = await prisma.user.findFirst({
      where: { dealerId: dealer.id },
      select: { id: true },
    })
    if (existingByDealer) {
      return NextResponse.json({ message: 'Dealer login already exists.' }, { status: 409 })
    }

    const existingByEmail = await prisma.user.findUnique({
      where: { email: dealer.email },
      select: { id: true },
    })
    if (existingByEmail) {
      return NextResponse.json(
        { message: 'Cannot create dealer login because this email is already used by another user.' },
        { status: 409 }
      )
    }

    const passwordHash = await hash(password, 10)
    await prisma.user.create({
      data: {
        email: dealer.email,
        password: passwordHash,
        role: 'DEALER',
        approved,
        dealerId: dealer.id,
      },
      select: { id: true },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    console.error('POST /api/admin/dealers/[id]/login error:', e)
    const status = typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number' ? (e as any).status : 500
    const message = typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string' ? (e as any).message : 'Internal server error'
    return NextResponse.json({ message }, { status })
  }
}
