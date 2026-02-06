import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

const STATUSES = new Set(['READY', 'RESERVED', 'IN_PRODUCTION', 'DAMAGED'])

type Status = 'READY' | 'RESERVED' | 'IN_PRODUCTION' | 'DAMAGED'

function colorKeyOf(colorId?: string | null) {
  return colorId ? colorId : 'NONE'
}

function parseDateInput(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date')
  return d
}

const baseInclude = {
  factory: { select: { id: true, name: true } },
  poolModel: { select: { id: true, name: true, lengthFt: true, widthFt: true, depthFt: true } },
  color: { select: { id: true, name: true, swatchUrl: true } },
}

export async function GET(req: NextRequest) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const { searchParams } = new URL(req.url)
    const factoryId = searchParams.get('factoryId') || undefined
    const poolModelId = searchParams.get('poolModelId') || undefined
    const colorId = searchParams.get('colorId') || undefined
    const status = searchParams.get('status') || undefined
    const includeZero = searchParams.get('includeZero') === 'true'

    if (status && !STATUSES.has(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    const where: any = {}
    if (factoryId) where.factoryId = factoryId
    if (poolModelId) where.poolModelId = poolModelId
    if (colorId) where.colorId = colorId
    if (status) where.status = status as Status
    if (!includeZero) where.quantity = { gt: 0 }

    const items = await prisma.poolStock.findMany({
      where,
      include: baseInclude,
      orderBy: [
        { factory: { name: 'asc' } },
        { poolModel: { name: 'asc' } },
        { color: { name: 'asc' } },
        { status: 'asc' },
      ],
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Internal Server Error' },
      { status: e?.status ?? 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const body = await req.json().catch(() => null)
    const factoryId = body?.factoryId?.toString().trim()
    const poolModelId = body?.poolModelId?.toString().trim()
    const colorIdRaw = body?.colorId
    const colorId = typeof colorIdRaw === 'string' && colorIdRaw.trim() !== '' ? colorIdRaw.trim() : null
    const status = body?.status?.toString().trim() as Status
    const qtyRaw = body?.quantity ?? 0
    const quantity = Number(qtyRaw)
    const notesRaw = body?.notes
    const notes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null
    const etaRaw = body?.eta
    const referenceOrderId = body?.referenceOrderId ?? null

    if (!factoryId || !poolModelId || !status) {
      return NextResponse.json({ message: 'factoryId, poolModelId, status are required' }, { status: 400 })
    }

    if (!STATUSES.has(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
      return NextResponse.json({ message: 'quantity must be an integer >= 0' }, { status: 400 })
    }

    const eta = etaRaw ? parseDateInput(etaRaw) : null
    const colorKey = colorKeyOf(colorId)

    const item = await prisma.$transaction(async (tx) => {
      const stock = await tx.poolStock.upsert({
        where: {
          factoryId_poolModelId_colorKey_status: {
            factoryId,
            poolModelId,
            colorKey,
            status,
          },
        },
        create: {
          factoryId,
          poolModelId,
          colorId,
          colorKey,
          status,
          quantity,
          eta,
          notes,
        },
        update: {
          quantity: quantity > 0 ? { increment: quantity } : undefined,
          eta: etaRaw !== undefined ? eta : undefined,
          notes: notesRaw !== undefined ? notes : undefined,
        },
        include: baseInclude,
      })

      if (quantity > 0) {
        await tx.poolStockTxn.create({
          data: {
            stockId: stock.id,
            type: 'ADD',
            quantity,
            referenceOrderId,
            notes,
          },
        })
      }

      return stock
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (e: any) {
    const status = e?.code === 'P2002' ? 409 : e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}
