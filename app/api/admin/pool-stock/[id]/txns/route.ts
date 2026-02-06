import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

const TYPES = new Set(['ADD', 'RESERVE', 'RELEASE', 'SHIP', 'ADJUST'])

type TxnType = 'ADD' | 'RESERVE' | 'RELEASE' | 'SHIP' | 'ADJUST'

const baseInclude = {
  factory: { select: { id: true, name: true } },
  poolModel: { select: { id: true, name: true, lengthFt: true, widthFt: true, depthFt: true } },
  color: { select: { id: true, name: true, swatchUrl: true } },
}

function deltaFor(type: TxnType, quantity: number) {
  if (type === 'RESERVE' || type === 'SHIP') return -Math.abs(quantity)
  return Math.abs(quantity)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const { searchParams } = new URL(req.url)
    const limitRaw = searchParams.get('limit') || '50'
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200)

    const items = await prisma.poolStockTxn.findMany({
      where: { stockId: params.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: { select: { id: true, status: true } },
      },
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Internal Server Error' },
      { status: e?.status ?? 500 }
    )
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const type = body?.type as TxnType
    const qtyRaw = body?.quantity
    const quantity = Number(qtyRaw)
    const referenceOrderId = body?.referenceOrderId ?? null
    const notesRaw = body?.notes
    const notes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null

    if (!type || !TYPES.has(type)) {
      return NextResponse.json({ message: 'Invalid type' }, { status: 400 })
    }

    if (!Number.isFinite(quantity)) {
      return NextResponse.json({ message: 'quantity must be a number' }, { status: 400 })
    }

    if (type !== 'ADJUST' && (quantity <= 0 || !Number.isInteger(quantity))) {
      return NextResponse.json({ message: 'quantity must be an integer > 0' }, { status: 400 })
    }

    if (type === 'ADJUST' && !Number.isInteger(quantity)) {
      return NextResponse.json({ message: 'quantity must be an integer for ADJUST' }, { status: 400 })
    }

    if (type === 'ADJUST' && quantity === 0) {
      return NextResponse.json({ message: 'quantity must be non-zero for ADJUST' }, { status: 400 })
    }

    const delta = type === 'ADJUST' ? quantity : deltaFor(type, quantity)

    const result = await prisma.$transaction(async (tx) => {
      const exists = await tx.poolStock.findUnique({
        where: { id: params.id },
        select: { id: true },
      })

      if (!exists) {
        throw Object.assign(new Error('Stock row not found'), { status: 404 })
      }

      const updated = await tx.poolStock.updateMany({
        where: {
          id: params.id,
          ...(delta < 0 ? { quantity: { gte: Math.abs(delta) } } : {}),
        },
        data: { quantity: { increment: delta } },
      })

      if (updated.count !== 1) {
        throw Object.assign(new Error('Insufficient stock for this operation'), { status: 409 })
      }

      const txn = await tx.poolStockTxn.create({
        data: {
          stockId: params.id,
          type,
          quantity: type === 'ADJUST' ? delta : Math.abs(quantity),
          referenceOrderId,
          notes,
        },
      })

      const stock = await tx.poolStock.findUnique({
        where: { id: params.id },
        include: baseInclude,
      })

      return { txn, stock }
    })

    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Internal Server Error' },
      { status: e?.status ?? 500 }
    )
  }
}
