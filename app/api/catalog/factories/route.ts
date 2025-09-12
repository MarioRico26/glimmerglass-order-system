import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const items = await prisma.factoryLocation.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, city: true, state: true },
  })
  return NextResponse.json({ items })
}