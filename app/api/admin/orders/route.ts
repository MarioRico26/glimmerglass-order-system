// glimmerglass-order-system/app/api/admin/orders/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { PenetrationMode } from '@prisma/client'
import { normalizeOrderStatus } from '@/lib/orderFlow'

type BlueprintMarker = { type: 'skimmer' | 'return' | 'drain'; x: number; y: number }

function parseBlueprintMarkers(input: unknown) {
  if (input === null || input === undefined || input === '') {
    return { markers: null as BlueprintMarker[] | null, error: null as string | null }
  }

  let parsed: unknown = input
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input)
    } catch {
      return { markers: null, error: 'Invalid blueprint markers JSON' }
    }
  }

  if (!Array.isArray(parsed)) {
    return { markers: null, error: 'Blueprint markers must be an array' }
  }

  const normalized: BlueprintMarker[] = []
  for (const entry of parsed) {
    const type = (entry as { type?: unknown })?.type
    const x = Number((entry as { x?: unknown })?.x)
    const y = Number((entry as { y?: unknown })?.y)
    if ((type !== 'skimmer' && type !== 'return' && type !== 'drain') || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { markers: null, error: 'Invalid blueprint marker' }
    }
    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return { markers: null, error: 'Blueprint marker out of range' }
    }
    normalized.push({ type, x, y })
  }

  return { markers: normalized.length ? normalized : null, error: null as string | null }
}

// GET: obtener lista de pedidos con filtros, paginación y relaciones
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role

    if (!session?.user?.email || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
    const sort = searchParams.get('sort') || 'createdAt'
    const dir = searchParams.get('dir') || 'desc'

    const q = searchParams.get('q') || ''
    const statusFilter = searchParams.get('status') || 'ALL'
    const dealerFilter = searchParams.get('dealer') || 'ALL'
    const factoryFilter = searchParams.get('factory') || 'ALL'

    // ✅ Subimos el límite a 200 porque el board pide 200.
    // Si luego quieres 500, lo hablamos, pero 200 ya es decente y evita traer “el universo”.
    if (page < 1 || pageSize < 1 || pageSize > 200) {
      return NextResponse.json({ message: 'Invalid pagination parameters' }, { status: 400 })
    }

    // ----- filtros -----
    const where: any = {}

    if (statusFilter !== 'ALL') {
      where.status =
        statusFilter === 'IN_PRODUCTION'
          ? { in: ['IN_PRODUCTION', 'APPROVED'] }
          : statusFilter
    }

    if (dealerFilter !== 'ALL') {
      where.dealer = { name: dealerFilter }
    }

    if (factoryFilter !== 'ALL') {
      where.factoryLocation = { name: factoryFilter }
    }

    if (q) {
      where.OR = [
        { deliveryAddress: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { dealer: { name: { contains: q, mode: 'insensitive' } } },
        { poolModel: { name: { contains: q, mode: 'insensitive' } } },
        { color: { name: { contains: q, mode: 'insensitive' } } },
        { factoryLocation: { name: { contains: q, mode: 'insensitive' } } },
      ]
    }

    // orderBy (sanitizado)
    const allowedSort = new Set([
      'createdAt',
      'status',
      'requestedShipDate',
      'scheduledShipDate',
      'scheduledProductionDate',
      'productionPriority',
    ])
    const safeSort = allowedSort.has(sort) ? sort : 'createdAt'

    const orderBy: any = {}
    orderBy[safeSort] = dir === 'asc' ? 'asc' : 'desc'

    // ✅ SOLO select (sin include)
    const orders = await prisma.order.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        deliveryAddress: true,
        status: true,
        paymentProofUrl: true,
        notes: true,
        shippingMethod: true,

        // ✅ LO QUE NECESITA EL BOARD
        requestedShipDate: true,
        scheduledShipDate: true,
        scheduledProductionDate: true,
        productionPriority: true,
        serialNumber: true,

        hardwareSkimmer: true,
        hardwareAutocover: true,
        hardwareReturns: true,
        hardwareMainDrains: true,

        createdAt: true,
        dealerId: true,
        poolModelId: true,
        colorId: true,
        factoryLocationId: true,

        poolModel: {
          select: {
            id: true,
            name: true,
            lengthFt: true,
            widthFt: true,
            depthFt: true,
            shape: true,
            defaultFactoryLocation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        color: {
          select: {
            id: true,
            name: true,
            swatchUrl: true,
          },
        },
        dealer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
        factoryLocation: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            active: true,
          },
        },
        histories: {
          where: { status: 'CANCELED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            comment: true,
            createdAt: true,
          },
        },
      },
    })

    const total = await prisma.order.count({ where })

    const items = orders.map((order) => ({
      ...order,
      status: normalizeOrderStatus(order.status)?.toString() ?? order.status,
      lastCancellationReason: order.histories[0]?.comment ?? null,
      lastCanceledAt: order.histories[0]?.createdAt?.toISOString() ?? null,
    }))

    return NextResponse.json({ items, page, pageSize, total })
  } catch (err: any) {
    console.error('GET /api/admin/orders error:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: crear nuevo pedido (lo dejo como lo tenés)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role
    const userEmail = (session?.user as any)?.email

    if (!session?.user?.email || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const penetrationModeRaw = body?.penetrationMode
    const penetrationMode: PenetrationMode =
      penetrationModeRaw === 'PENETRATIONS_WITH_INSTALL' ||
      penetrationModeRaw === 'NO_PENETRATIONS' ||
      penetrationModeRaw === 'OTHER'
        ? penetrationModeRaw
        : 'PENETRATIONS_WITHOUT_INSTALL'
    const penetrationNotes =
      typeof body?.penetrationNotes === 'string' ? body.penetrationNotes.trim() : ''

    const requiredFields = ['deliveryAddress', 'dealerId', 'poolModelId', 'colorId', 'factoryLocationId']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ message: `Missing required field: ${field}` }, { status: 400 })
      }
    }
    if (penetrationMode === 'OTHER' && !penetrationNotes) {
      return NextResponse.json({ message: 'penetrationNotes is required when penetrationMode is OTHER' }, { status: 400 })
    }

    const markerResult = parseBlueprintMarkers(body?.blueprintMarkers)
    if (markerResult.error) {
      return NextResponse.json({ message: markerResult.error }, { status: 400 })
    }

    const selectedPoolModel = await prisma.poolModel.findUnique({
      where: { id: body.poolModelId },
      select: {
        id: true,
        maxSkimmers: true,
        maxReturns: true,
        maxMainDrains: true,
      },
    })
    if (!selectedPoolModel) {
      return NextResponse.json({ message: 'Pool model not found' }, { status: 404 })
    }

    let blueprintMarkers = markerResult.markers
    if (penetrationMode === 'NO_PENETRATIONS') {
      blueprintMarkers = null
    } else if (blueprintMarkers?.length) {
      const countSkimmers = blueprintMarkers.filter((m) => m.type === 'skimmer').length
      const countReturns = blueprintMarkers.filter((m) => m.type === 'return').length
      const countDrains = blueprintMarkers.filter((m) => m.type === 'drain').length

      if (
        typeof selectedPoolModel.maxSkimmers === 'number' &&
        countSkimmers > selectedPoolModel.maxSkimmers
      ) {
        return NextResponse.json(
          { message: `Skimmer markers exceed model limit (${selectedPoolModel.maxSkimmers})` },
          { status: 400 }
        )
      }
      if (
        typeof selectedPoolModel.maxReturns === 'number' &&
        countReturns > selectedPoolModel.maxReturns
      ) {
        return NextResponse.json(
          { message: `Return markers exceed model limit (${selectedPoolModel.maxReturns})` },
          { status: 400 }
        )
      }
      if (
        typeof selectedPoolModel.maxMainDrains === 'number' &&
        countDrains > selectedPoolModel.maxMainDrains
      ) {
        return NextResponse.json(
          { message: `Main drain markers exceed model limit (${selectedPoolModel.maxMainDrains})` },
          { status: 400 }
        )
      }
    }

    const newOrder = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          deliveryAddress: body.deliveryAddress,
          status: 'PENDING_PAYMENT_APPROVAL',
          dealerId: body.dealerId,
          poolModelId: body.poolModelId,
          colorId: body.colorId,
          factoryLocationId: body.factoryLocationId,
          notes: body.notes || null,
          paymentProofUrl: body.paymentProofUrl || null,
          blueprintMarkers,
          shippingMethod: body.shippingMethod || null,
          penetrationMode,
          penetrationNotes: penetrationNotes || null,
          hardwareSkimmer: body.hardwareSkimmer || false,
          hardwareAutocover: body.hardwareAutocover || false,
          hardwareReturns: body.hardwareReturns || false,
          hardwareMainDrains: body.hardwareMainDrains || false,

          requestedShipDate: body.requestedShipDate ? new Date(body.requestedShipDate) : null,
          scheduledShipDate: body.scheduledShipDate ? new Date(body.scheduledShipDate) : null,
          scheduledProductionDate: body.scheduledProductionDate
            ? new Date(body.scheduledProductionDate)
            : null,
          productionPriority:
            typeof body.productionPriority === 'number' ? body.productionPriority : null,
        },
        include: {
          poolModel: { select: { name: true } },
          color: { select: { name: true } },
          dealer: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      })

      await tx.orderHistory.create({
        data: {
          orderId: created.id,
          status: created.status,
          comment: body.notes
            ? `Order created by admin. Initial notes: ${body.notes}`
            : 'Order created by admin',
          userId: dbUser.id,
        },
      })

      return created
    })

    return NextResponse.json({ message: 'Order created successfully', order: newOrder }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/admin/orders error:', err)

    if (err.code === 'P2002') return NextResponse.json({ message: 'Duplicate order data' }, { status: 400 })
    if (err.code === 'P2003') return NextResponse.json({ message: 'Invalid reference ID' }, { status: 400 })

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
