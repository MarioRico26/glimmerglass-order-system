import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.poolModel.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        lengthFt: true,
        widthFt: true,
        depthFt: true,
        imageUrl: true,
        blueprintUrl: true,
        hasIntegratedSpa: true,
        maxSkimmers: true,
        maxReturns: true,
        maxMainDrains: true,
        defaultFactoryLocationId: true,
        defaultFactoryLocation: { select: { id: true, name: true } },
      },
    })
    return NextResponse.json({ items })
  } catch (err) {
    try {
      // Fallback for out-of-sync DB schema (missing newer columns).
      const legacyItems = await prisma.poolModel.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          lengthFt: true,
          widthFt: true,
          depthFt: true,
          imageUrl: true,
          blueprintUrl: true,
          defaultFactoryLocationId: true,
        },
      })
      const items = legacyItems.map((row) => ({
        ...row,
        hasIntegratedSpa: false,
        maxSkimmers: null,
        maxReturns: null,
        maxMainDrains: null,
        defaultFactoryLocation: null,
      }))
      return NextResponse.json({ items })
    } catch {
      try {
        const minimal = await prisma.poolModel.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        })
        const items = minimal.map((row) => ({
          ...row,
          lengthFt: null,
          widthFt: null,
          depthFt: null,
          imageUrl: null,
          blueprintUrl: null,
          hasIntegratedSpa: false,
          maxSkimmers: null,
          maxReturns: null,
          maxMainDrains: null,
          defaultFactoryLocationId: null,
          defaultFactoryLocation: null,
        }))
        return NextResponse.json({ items })
      } catch {
        console.error('GET /api/catalog/pool-models failed:', err)
        return NextResponse.json(
          { message: 'Failed to load pool models. Please run latest Prisma migrations.' },
          { status: 500 }
        )
      }
    }
  }
}
