export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { AdminModule, BuildMaterialCategory } from '@prisma/client'

import { assertFactoryAccess, requireAdminAccess } from '@/lib/adminAccess'
import { prisma } from '@/lib/prisma'

const DEFAULT_SECTIONS: Record<BuildMaterialCategory, string[]> = {
  GEL_COAT: ['Drum 1', 'Drum 2', 'Drum 3'],
  SKIN_RESIN: ['Drum 1', 'Drum 2', 'Drum 3'],
  BUILD_UP_RESIN: ['Drum 1', 'Drum 2', 'Drum 3'],
  CHOP: ['Roll 1', 'Roll 2'],
  OIL: ['Cat Gallon', 'Cat Used', 'Cat / Unit', 'Cob Volume', 'Lionel Combo'],
}

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }

type MaterialInput = {
  category: BuildMaterialCategory
  slotLabel: string
  sortOrder?: number
  batchNumber?: string | null
  startWeight?: number | null
  finishWeight?: number | null
  netWeight?: number | null
  totalWeight?: number | null
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

async function getOrderId(ctx: Ctx) {
  const params = await Promise.resolve(ctx.params)
  return params.id
}

function normalizeMaterialRows(input: unknown): MaterialInput[] {
  if (!Array.isArray(input)) return []

  const rows: MaterialInput[] = []
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const category = row.category
    const slotLabel = typeof row.slotLabel === 'string' ? row.slotLabel.trim() : ''
    if (!category || !Object.values(BuildMaterialCategory).includes(category as BuildMaterialCategory) || !slotLabel) {
      continue
    }
    rows.push({
      category: category as BuildMaterialCategory,
      slotLabel,
      sortOrder: typeof row.sortOrder === 'number' ? row.sortOrder : 0,
      batchNumber: typeof row.batchNumber === 'string' ? row.batchNumber.trim() || null : null,
      startWeight: parseNullableNumber(row.startWeight),
      finishWeight: parseNullableNumber(row.finishWeight),
      netWeight: parseNullableNumber(row.netWeight),
      totalWeight: parseNullableNumber(row.totalWeight),
    })
  }

  return rows
}

function makeDefaultRows() {
  return Object.entries(DEFAULT_SECTIONS).flatMap(([category, slots]) =>
    slots.map((slotLabel, index) => ({
      category: category as BuildMaterialCategory,
      slotLabel,
      sortOrder: index,
      batchNumber: null,
      startWeight: null,
      finishWeight: null,
      netWeight: null,
      totalWeight: null,
    }))
  )
}

function formatRecord(record: {
  id: string
  orderId: string
  dateBuilt: Date | null
  gelGunOperator: string | null
  chopGunOperator: string | null
  outsideTemp: string | null
  moldTemp: string | null
  buildTeam: string | null
  shellWeight: number | null
  buildHours: number | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  materialUsages: Array<{
    id: string
    category: BuildMaterialCategory
    slotLabel: string
    sortOrder: number
    batchNumber: string | null
    startWeight: number | null
    finishWeight: number | null
    netWeight: number | null
    totalWeight: number | null
  }>
}) {
  return {
    id: record.id,
    orderId: record.orderId,
    dateBuilt: record.dateBuilt ? record.dateBuilt.toISOString() : null,
    gelGunOperator: record.gelGunOperator,
    chopGunOperator: record.chopGunOperator,
    outsideTemp: record.outsideTemp,
    moldTemp: record.moldTemp,
    buildTeam: record.buildTeam,
    shellWeight: record.shellWeight,
    buildHours: record.buildHours,
    notes: record.notes,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    materialUsages: record.materialUsages.map((row) => ({
      ...row,
      batchNumber: row.batchNumber ?? null,
      startWeight: row.startWeight ?? null,
      finishWeight: row.finishWeight ?? null,
      netWeight: row.netWeight ?? null,
      totalWeight: row.totalWeight ?? null,
    })),
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.ORDER_LIST)
    const orderId = await getOrderId(ctx)

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, factoryLocationId: true },
    })

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    assertFactoryAccess(access, order.factoryLocationId)

    const record = await prisma.orderBuildRecord.findUnique({
      where: { orderId },
      include: {
        materialUsages: {
          orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        },
      },
    })

    if (!record) {
      return NextResponse.json({ record: null, defaults: makeDefaultRows() })
    }

    return NextResponse.json({ record: formatRecord(record), defaults: makeDefaultRows() })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Internal Server Error' }, { status: e?.status || 500 })
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const access = await requireAdminAccess(AdminModule.ORDER_LIST)
    const orderId = await getOrderId(ctx)
    const body = await req.json()

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, factoryLocationId: true, status: true },
    })

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    assertFactoryAccess(access, order.factoryLocationId)

    const materialUsages = normalizeMaterialRows(body?.materialUsages)
    const dateBuilt = body?.dateBuilt ? new Date(body.dateBuilt) : null
    if (body?.dateBuilt && Number.isNaN(dateBuilt?.getTime())) {
      return NextResponse.json({ message: 'Invalid dateBuilt value' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const upserted = await tx.orderBuildRecord.upsert({
        where: { orderId },
        create: {
          orderId,
          dateBuilt,
          gelGunOperator: typeof body?.gelGunOperator === 'string' ? body.gelGunOperator.trim() || null : null,
          chopGunOperator: typeof body?.chopGunOperator === 'string' ? body.chopGunOperator.trim() || null : null,
          outsideTemp: typeof body?.outsideTemp === 'string' ? body.outsideTemp.trim() || null : null,
          moldTemp: typeof body?.moldTemp === 'string' ? body.moldTemp.trim() || null : null,
          buildTeam: typeof body?.buildTeam === 'string' ? body.buildTeam.trim() || null : null,
          shellWeight: parseNullableNumber(body?.shellWeight),
          buildHours: parseNullableNumber(body?.buildHours),
          notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
        },
        update: {
          dateBuilt,
          gelGunOperator: typeof body?.gelGunOperator === 'string' ? body.gelGunOperator.trim() || null : null,
          chopGunOperator: typeof body?.chopGunOperator === 'string' ? body.chopGunOperator.trim() || null : null,
          outsideTemp: typeof body?.outsideTemp === 'string' ? body.outsideTemp.trim() || null : null,
          moldTemp: typeof body?.moldTemp === 'string' ? body.moldTemp.trim() || null : null,
          buildTeam: typeof body?.buildTeam === 'string' ? body.buildTeam.trim() || null : null,
          shellWeight: parseNullableNumber(body?.shellWeight),
          buildHours: parseNullableNumber(body?.buildHours),
          notes: typeof body?.notes === 'string' ? body.notes.trim() || null : null,
        },
      })

      await tx.orderBuildMaterialUsage.deleteMany({ where: { buildRecordId: upserted.id } })
      if (materialUsages.length) {
        await tx.orderBuildMaterialUsage.createMany({
          data: materialUsages.map((row) => ({
            buildRecordId: upserted.id,
            category: row.category,
            slotLabel: row.slotLabel,
            sortOrder: row.sortOrder || 0,
            batchNumber: row.batchNumber,
            startWeight: row.startWeight,
            finishWeight: row.finishWeight,
            netWeight: row.netWeight,
            totalWeight: row.totalWeight,
          })),
        })
      }

      await tx.orderHistory.create({
        data: {
          orderId,
          status: order.status,
          comment: 'Production build record updated by admin',
          userId: access.userId,
        },
      })

      return tx.orderBuildRecord.findUniqueOrThrow({
        where: { orderId },
        include: { materialUsages: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] } },
      })
    })

    return NextResponse.json({ record: formatRecord(result) })
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || 'Internal Server Error' }, { status: e?.status || 500 })
  }
}
