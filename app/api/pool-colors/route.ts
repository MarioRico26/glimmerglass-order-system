import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const colors = await prisma.poolColor.findMany()
    return NextResponse.json(colors)
  } catch (error) {
    console.error('Error fetching pool colors:', error)
    return NextResponse.json({ message: 'Failed to load colors' }, { status: 500 })
  }
}