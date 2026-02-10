import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string | null; role?: string } | undefined

    if (!user?.email || user?.role !== 'DEALER') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const factoryId = searchParams.get('factoryId') || undefined
    const poolModelId = searchParams.get('poolModelId') || undefined
    const colorId = searchParams.get('colorId') || undefined

    const where: {
      status: 'READY'
      quantity: { gt: number }
      factoryId?: string
      poolModelId?: string
      colorId?: string
    } = {
      status: 'READY',
      quantity: { gt: 0 },
    }

    if (factoryId) where.factoryId = factoryId
    if (poolModelId) where.poolModelId = poolModelId
    if (colorId) where.colorId = colorId

    const items = await prisma.poolStock.findMany({
      where,
      orderBy: [
        { factory: { name: 'asc' } },
        { poolModel: { name: 'asc' } },
        { color: { name: 'asc' } },
      ],
      select: {
        id: true,
        status: true,
        quantity: true,
        eta: true,
        factory: { select: { id: true, name: true, city: true, state: true } },
        poolModel: { select: { id: true, name: true, lengthFt: true, widthFt: true, depthFt: true } },
        color: { select: { id: true, name: true, swatchUrl: true } },
        imageUrl: true,
      },
    })

    return NextResponse.json({ items })
  } catch (e: unknown) {
    console.error('GET /api/dealer/in-stock error:', e)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
