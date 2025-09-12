// glimmerglass-order-system/app/api/dealers/route.ts

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const dealers = await prisma.dealer.findMany({
      include: {
        user: {
          select: {
            approved: true
          }
        }
      }
    })

    // Map to include approved status from user
    const formatted = dealers.map(dealer => ({
      id: dealer.id,
      name: dealer.name,
      email: dealer.email,
      phone: dealer.phone,
      city: dealer.city,
      state: dealer.state,
      approved: dealer.user?.approved ?? false
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('❌ Error fetching dealers:', error)
    return NextResponse.json({ error: 'Failed to fetch dealers' }, { status: 500 })
  }
}