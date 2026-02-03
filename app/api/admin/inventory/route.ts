import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const locations = await prisma.inventoryLocation.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, active: true },
    })

    return NextResponse.json({ locations })
  } catch (err: any) {
    console.error('GET /api/admin/inventory error:', err)
    return NextResponse.json(
      { error: 'Failed to load inventory locations' },
      { status: 500 }
    )
  }
}