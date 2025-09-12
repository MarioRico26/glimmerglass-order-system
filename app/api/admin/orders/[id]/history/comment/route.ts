import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@prisma/client'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(req, authOptions)
  const userEmail = session?.user?.email

  if (!userEmail) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  })

  if (!user) {
    return NextResponse.json({ message: 'User not found' }, { status: 404 })
  }

  // Validar si el usuario es admin o superadmin
  if (user.role !== Role.ADMIN && user.role !== Role.SUPERADMIN) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const orderId = params.id
  const { status, comment } = await req.json()

  try {
    const newHistory = await prisma.orderHistory.create({
      data: {
        orderId,
        status,
        comment,
        userId: user.id,
      },
    })

    return NextResponse.json(newHistory)
  } catch (error) {
    console.error('Error creating manual history entry:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}