import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertFactoryAccess, requireAdminAccess, scopedFactoryWhere } from '@/lib/adminAccess'
import { parseDateOnlyToUtcNoon } from '@/lib/dateOnly'

const STATUSES = new Set(['READY', 'RESERVED', 'IN_PRODUCTION', 'DAMAGED'])

type Status = 'READY' | 'RESERVED' | 'IN_PRODUCTION' | 'DAMAGED'

function colorKeyOf(colorId?: string | null) {
  return colorId ? colorId : 'NONE'
}

function parseDateInput(value: string) {
  const d = parseDateOnlyToUtcNoon(value)
  if (!d) throw new Error('Invalid date')
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
    const access = await requireAdminAccess(AdminModule.POOL_STOCK)

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
    Object.assign(where, scopedFactoryWhere(access, 'factoryId'))
    if (factoryId) {
      assertFactoryAccess(access, factoryId)
      where.factoryId = factoryId
    }
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
    const access = await requireAdminAccess(AdminModule.POOL_STOCK)

    const body = await req.json().catch(() => null)
    const factoryId = body?.factoryId?.toString().trim()
    const poolModelId = body?.poolModelId?.toString().trim()
    const colorIdRaw = body?.colorId
    const colorId = typeof colorIdRaw === 'string' && colorIdRaw.trim() !== '' ? colorIdRaw.trim() : null
    const status = body?.status?.toString().trim() as Status
    const notesRaw = body?.notes
    const notes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null
    const etaRaw = body?.eta
    const productionDateRaw = body?.productionDate
    const serialNumberRaw = body?.serialNumber
    const serialNumber =
      typeof serialNumberRaw === 'string' && serialNumberRaw.trim() !== ''
        ? serialNumberRaw.trim()
        : null
    const referenceOrderId = body?.referenceOrderId ?? null

    if (!factoryId || !poolModelId || !status) {
      return NextResponse.json({ message: 'factoryId, poolModelId, status are required' }, { status: 400 })
    }

    assertFactoryAccess(access, factoryId)

    if (!STATUSES.has(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    const quantity = 1
    if (body?.quantity !== undefined && Number(body.quantity) !== 1) {
      return NextResponse.json(
        { message: 'Pool stock is now unit-based. Add one physical pool per row.' },
        { status: 400 }
      )
    }

    const eta = etaRaw ? parseDateInput(etaRaw) : null
    const productionDate = productionDateRaw ? parseDateInput(productionDateRaw) : null

    if (status === 'READY') {
      if (!serialNumber) {
        return NextResponse.json(
          { message: 'serialNumber is required for READY stock rows' },
          { status: 400 }
        )
      }
      if (!productionDate) {
        return NextResponse.json(
          { message: 'productionDate is required for READY stock rows' },
          { status: 400 }
        )
      }
    }
    const colorKey = colorKeyOf(colorId)

    const item = await prisma.$transaction(async (tx) => {
      const stock = await tx.poolStock.create({
        data: {
          factoryId,
          poolModelId,
          colorId,
          colorKey,
          status,
          quantity,
          eta,
          productionDate,
          serialNumber,
          notes,
        },
        include: baseInclude,
      })

      await tx.poolStockTxn.create({
        data: {
          stockId: stock.id,
          type: 'ADD',
          quantity: 1,
          referenceOrderId,
          notes,
        },
      })

      return stock
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (e: any) {
    const status = e?.code === 'P2002' ? 409 : e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}
