import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertFactoryAccess, requireAdminAccess } from '@/lib/adminAccess'

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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdminAccess(AdminModule.POOL_STOCK)
    const item = await prisma.poolStock.findUnique({
      where: { id: params.id },
      include: baseInclude,
    })
    if (!item) return NextResponse.json({ message: 'Not found' }, { status: 404 })
    assertFactoryAccess(access, item.factoryId)
    return NextResponse.json({ item })
  } catch (e: any) {
    return NextResponse.json(
      { message: e?.message ?? 'Internal Server Error' },
      { status: e?.status ?? 500 }
    )
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireAdminAccess(AdminModule.POOL_STOCK)

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
    }

    const status = body?.status as Status | undefined
    const qtyRaw = body?.quantity
    const quantity = qtyRaw !== undefined ? Number(qtyRaw) : undefined
    const notesRaw = body?.notes
    const notes = typeof notesRaw === 'string' && notesRaw.trim() !== '' ? notesRaw.trim() : null
    const etaRaw = body?.eta
    const productionDateRaw = body?.productionDate
    const serialNumberRaw = body?.serialNumber
    const serialNumber =
      typeof serialNumberRaw === 'string' && serialNumberRaw.trim() !== ''
        ? serialNumberRaw.trim()
        : null
    const colorIdRaw = body?.colorId
    const colorId = body?.colorId === null
      ? null
      : typeof colorIdRaw === 'string' && colorIdRaw.trim() !== ''
        ? colorIdRaw.trim()
        : undefined
    const txnNoteRaw = body?.txnNote
    const txnNote = typeof txnNoteRaw === 'string' && txnNoteRaw.trim() !== '' ? txnNoteRaw.trim() : null

    if (status && !STATUSES.has(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    if (quantity !== undefined) {
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 0) {
        return NextResponse.json({ message: 'quantity must be an integer >= 0' }, { status: 400 })
      }
      if (quantity !== 1) {
        return NextResponse.json(
          { message: 'Pool stock rows now represent single physical units. Quantity must remain 1.' },
          { status: 400 }
        )
      }
    }

    const eta = etaRaw === null ? null : etaRaw ? parseDateInput(etaRaw) : undefined
    const productionDate =
      productionDateRaw === null
        ? null
        : productionDateRaw
          ? parseDateInput(productionDateRaw)
          : undefined

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.poolStock.findUnique({ where: { id: params.id } })
      if (!current) {
        throw Object.assign(new Error('Not found'), { status: 404 })
      }
      assertFactoryAccess(access, current.factoryId)
      const currentAny = current as any

      const data: any = {}
      let delta = 0

      if (quantity !== undefined && quantity !== current.quantity) {
        delta = quantity - current.quantity
        data.quantity = quantity
      }

      if (status) data.status = status

      if (etaRaw !== undefined) data.eta = eta

      if (productionDateRaw !== undefined) data.productionDate = productionDate

      if (serialNumberRaw !== undefined) data.serialNumber = serialNumber

      if (notesRaw !== undefined) data.notes = notes

      if (colorIdRaw !== undefined) {
        data.colorId = colorId ?? null
        data.colorKey = colorKeyOf(colorId ?? null)
      }

      if (Object.keys(data).length === 0) {
        throw Object.assign(new Error('No valid fields to update'), { status: 400 })
      }

      const nextStatus = (data.status ?? current.status) as Status
      const nextQuantity = typeof data.quantity === 'number' ? data.quantity : current.quantity
      const nextSerial =
        data.serialNumber !== undefined ? (data.serialNumber as string | null) : currentAny.serialNumber
      const nextProductionDate =
        data.productionDate !== undefined
          ? (data.productionDate as Date | null)
          : currentAny.productionDate

      if (nextStatus === 'READY' && nextQuantity > 0) {
        if (!nextSerial) {
          throw Object.assign(new Error('serialNumber is required for READY stock rows'), {
            status: 400,
          })
        }
        if (!nextProductionDate) {
          throw Object.assign(new Error('productionDate is required for READY stock rows'), {
            status: 400,
          })
        }
      }

      const updated = await tx.poolStock.update({
        where: { id: params.id },
        data,
        include: baseInclude,
      })

      if (delta !== 0) {
        await tx.poolStockTxn.create({
          data: {
            stockId: params.id,
            type: 'ADJUST',
            quantity: delta,
            notes: txnNote ?? notes ?? null,
          },
        })
      } else if (data.status || data.colorKey) {
        await tx.poolStockTxn.create({
          data: {
            stockId: params.id,
            type: 'ADJUST',
            quantity: 0,
            notes: txnNote ?? 'Status/color updated',
          },
        })
      }

      return updated
    })

    return NextResponse.json({ item: result })
  } catch (e: any) {
    const status = e?.code === 'P2002' ? 409 : e?.status ?? 500
    const message = e?.message ?? 'Internal Server Error'
    return NextResponse.json({ message }, { status })
  }
}
