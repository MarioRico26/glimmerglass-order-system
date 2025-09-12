// app/api/admin/dealers/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !['ADMIN', 'SUPERADMIN'].includes(session.user?.role as any)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const dealers = await prisma.dealer.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        agreementUrl: true,     // 👈 IMPORTANTE: incluir el URL del acuerdo
        createdAt: true,
        User: {
          select: { approved: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const payload = dealers.map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      phone: d.phone ?? '',
      city: d.city ?? '',
      state: d.state ?? '',
      approved: d.User?.approved ?? false,
      agreementUrl: d.agreementUrl ?? null, // 👈 el front ya lo renderiza
    }))

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    console.error('Error fetching dealers:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}