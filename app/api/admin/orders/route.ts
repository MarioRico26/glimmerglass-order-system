// app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

// GET: obtener lista de pedidos con shippingMethod y todos los campos necesarios
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const sort = searchParams.get('sort') || 'createdAt'
    const dir = searchParams.get('dir') || 'desc'

    // Validar parámetros
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ message: 'Invalid pagination parameters' }, { status: 400 })
    }

    // Construir orderBy
    const orderBy: any = {}
    orderBy[sort] = dir

    // Obtener pedidos con todas las relaciones según tu schema
    const orders = await prisma.order.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        poolModel: { 
          select: { 
            id: true,
            name: true,
            lengthFt: true,
            widthFt: true,
            depthFt: true,
            shape: true
          } 
        },
        color: { 
          select: { 
            id: true,
            name: true,
            swatchUrl: true
          } 
        },
        dealer: { 
          select: { 
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true
          } 
        },
        factoryLocation: { 
          select: { 
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            active: true
          } 
        },
      },
      select: {
        id: true,
        deliveryAddress: true,
        status: true,
        paymentProofUrl: true,
        notes: true,
        shippingMethod: true,  // ← CAMPO CLAVE AÑADIDO
        hardwareSkimmer: true,
        hardwareAutocover: true,
        hardwareReturns: true,
        hardwareMainDrains: true,
        createdAt: true,
        dealerId: true,
        poolModelId: true,
        colorId: true,
        factoryLocationId: true,
      },
      orderBy: orderBy
    })

    // Obtener total count para paginación
    const total = await prisma.order.count()

    return NextResponse.json({
      items: orders,
      page,
      pageSize,
      total
    })

  } catch (err: any) {
    console.error('GET /api/admin/orders error:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: crear nuevo pedido
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Validaciones básicas
    const requiredFields = ['deliveryAddress', 'dealerId', 'poolModelId', 'colorId', 'factoryLocationId']
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ message: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    // Crear nuevo pedido
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
      },
      include: {
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        dealer: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      }
    })

    return NextResponse.json({
      message: 'Order created successfully',
      order: newOrder
    }, { status: 201 })

  } catch (err: any) {
    console.error('POST /api/admin/orders error:', err)
    
    // Manejar errores de constraint de base de datos
    if (err.code === 'P2002') {
      return NextResponse.json({ message: 'Duplicate order data' }, { status: 400 })
    }
    if (err.code === 'P2003') {
      return NextResponse.json({ message: 'Invalid reference ID' }, { status: 400 })
    }
    
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}