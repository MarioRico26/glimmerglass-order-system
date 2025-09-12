import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const models = await prisma.poolModel.findMany()
    return NextResponse.json(models)
  } catch (error) {
    console.error('Error fetching pool models:', error)
    return NextResponse.json({ message: 'Failed to load models' }, { status: 500 })
  }
}