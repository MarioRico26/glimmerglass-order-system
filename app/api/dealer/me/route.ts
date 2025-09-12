// app/api/dealer/me/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    if (!user || user.role !== 'DEALER' || !user.dealerId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const dealer = await prisma.dealer.findUnique({
      where: { id: user.dealerId },
      select: {
        id: true,
        name: true,
        agreementUrl: true,
        agreementSignatureUrl: true,
        agreementSignedAt: true,
      },
    })

    if (!dealer) {
      return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
    }

    return NextResponse.json({
      dealerId: dealer.id,
      name: dealer.name,
      agreementUrl: dealer.agreementUrl,
      agreementSignatureUrl: dealer.agreementSignatureUrl,
      agreementSignedAt: dealer.agreementSignedAt
        ? dealer.agreementSignedAt.toISOString()
        : null,
    })
  } catch (e) {
    console.error('GET /api/dealer/me error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}