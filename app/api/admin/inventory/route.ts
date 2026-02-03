import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const locations = await prisma.inventoryLocation.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true, active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ locations })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to load inventory metadata' },
      { status: 500 }
    )
  }
}