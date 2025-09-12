// app/api/factories/route.ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const factories = await prisma.factoryLocation.findMany()
    return NextResponse.json(factories)
  } catch (error) {
    console.error('Error fetching factories:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}