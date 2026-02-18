import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

type BlueprintMarkerType = 'skimmer' | 'return' | 'drain'
type BlueprintMarker = { type: BlueprintMarkerType; x: number; y: number }

function normalizeBlueprintMarkers(raw: unknown): BlueprintMarker[] {
  if (!Array.isArray(raw)) return []

  const out: BlueprintMarker[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const maybe = item as { type?: unknown; x?: unknown; y?: unknown }
    if (maybe.type !== 'skimmer' && maybe.type !== 'return' && maybe.type !== 'drain') continue
    if (typeof maybe.x !== 'number' || typeof maybe.y !== 'number') continue
    if (!Number.isFinite(maybe.x) || !Number.isFinite(maybe.y)) continue

    out.push({
      type: maybe.type,
      x: Math.max(0, Math.min(100, maybe.x)),
      y: Math.max(0, Math.min(100, maybe.y)),
    })
  }
  return out
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { dealer: true },
  })
  if (!user?.dealer) {
    return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
  }

  const order = await prisma.order.findFirst({
    where: { id: params.id, dealerId: user.dealer.id },
    select: {
      id: true,
      blueprintMarkers: true,
      poolModel: { select: { name: true, blueprintUrl: true } },
    },
  })

  if (!order) {
    return NextResponse.json({ message: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: order.id,
    poolModel: order.poolModel,
    blueprintMarkers: normalizeBlueprintMarkers(order.blueprintMarkers),
  })
}
