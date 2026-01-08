// glimmerglass-order-system/app/api/admin/orders/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

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
      where.status = statusFilter
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
        productionPriority: true,

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
      },
    })

    const total = await prisma.order.count({ where })

    return NextResponse.json({ items: orders, page, pageSize, total })
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

    if (!session?.user?.email || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    const requiredFields = ['deliveryAddress', 'dealerId', 'poolModelId', 'colorId', 'factoryLocationId']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ message: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const newOrder = await prisma.order.create({
      data: {
        deliveryAddress: body.deliveryAddress,
        status: 'PENDING_PAYMENT_APPROVAL',
        dealerId: body.dealerId,
        poolModelId: body.poolModelId,
        colorId: body.colorId,
        factoryLocationId: body.factoryLocationId,
        notes: body.notes || null,
        paymentProofUrl: body.paymentProofUrl || null,
        shippingMethod: body.shippingMethod || null,
        hardwareSkimmer: body.hardwareSkimmer || false,
        hardwareAutocover: body.hardwareAutocover || false,
        hardwareReturns: body.hardwareReturns || false,
        hardwareMainDrains: body.hardwareMainDrains || false,

        // (opcional, si querés permitirlo al crear)
        requestedShipDate: body.requestedShipDate ? new Date(body.requestedShipDate) : null,
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

    return NextResponse.json({ message: 'Order created successfully', order: newOrder }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/admin/orders error:', err)

    if (err.code === 'P2002') return NextResponse.json({ message: 'Duplicate order data' }, { status: 400 })
    if (err.code === 'P2003') return NextResponse.json({ message: 'Invalid reference ID' }, { status: 400 })

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}