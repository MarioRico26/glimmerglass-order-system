import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.color.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, swatchUrl: true },
  })
  return NextResponse.json({ items })
}