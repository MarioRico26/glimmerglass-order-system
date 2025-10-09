// app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

// GET: obtener lista de pedidos con shippingMethod
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

    // Obtener pedidos con shippingMethod incluido
    const orders = await prisma.order.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        dealer: { select: { name: true } },
        factory: { select: { name: true } },
      },
      select: {
        id: true,
        deliveryAddress: true,
        status: true,
        paymentProofUrl: true,
        shippingMethod: true,  // ← CAMPO AÑADIDO
        createdAt: true,
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

// POST: crear nuevo pedido (si lo necesitas)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPERADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    
    // Aquí iría la lógica para crear un nuevo pedido
    // const newOrder = await prisma.order.create({ ... })
    
    return NextResponse.json({ message: 'Order created successfully' }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/admin/orders error:', err)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}