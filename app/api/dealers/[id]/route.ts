import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const dealerId = params.id

  try {
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      include: { user: true },
    })

    if (!dealer || !dealer.user) {
      return NextResponse.json({ message: 'Dealer or associated user not found' }, { status: 404 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: dealer.user.id },
      data: {
        approved: !dealer.user.approved,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Error toggling approval:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}