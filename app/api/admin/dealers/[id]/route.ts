// app/api/admin/dealers/[id]/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'SUPERADMIN'].includes(session.user?.role as any)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const dealerId = params.id
  const { approved } = await req.json() as { approved?: boolean }

  if (typeof approved !== 'boolean') {
    return NextResponse.json({ message: 'Invalid body' }, { status: 400 })
  }

  try {
    const user = await prisma.user.findFirst({ where: { dealerId } })
    if (!user) {
      return NextResponse.json({ message: 'User for dealer not found' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { approved },
    })

    // (opcional) devolver el dealer “refrescado” para actualizar UI sin refetch
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        agreementUrl: true,
        User: { select: { approved: true } },
      },
    })

    return NextResponse.json({
      ok: true,
      dealer: dealer ? {
        id: dealer.id,
        name: dealer.name,
        email: dealer.email,
        phone: dealer.phone ?? '',
        city: dealer.city ?? '',
        state: dealer.state ?? '',
        approved: dealer.User?.approved ?? false,
        agreementUrl: dealer.agreementUrl ?? null,
      } : null
    }, { status: 200 })
  } catch (error) {
    console.error('Error updating dealer approval:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}