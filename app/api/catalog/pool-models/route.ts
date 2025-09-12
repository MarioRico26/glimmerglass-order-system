import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.poolModel.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, lengthFt: true, widthFt: true, depthFt: true },
  })
  return NextResponse.json({ items })
}