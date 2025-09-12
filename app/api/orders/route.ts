// app/api/orders/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const poolModelId       = formData.get('poolModelId')?.toString() || ''
    const colorId           = formData.get('colorId')?.toString() || ''
    const factoryLocationId = formData.get('factoryLocationId')?.toString() || ''
    const dealerId          = formData.get('dealerId')?.toString() || ''
    const notes             = formData.get('notes')?.toString() || ''
    const deliveryAddress   = formData.get('deliveryAddress')?.toString() || ''
    const file              = formData.get('paymentProof') as File | null

    if (!dealerId || !file || !poolModelId || !colorId || !factoryLocationId || !deliveryAddress) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 })
    }

    // Validaciones de existencia
    const [dealer, factory, poolModel, color] = await Promise.all([
      prisma.dealer.findUnique({ where: { id: dealerId } }),
      prisma.factoryLocation.findUnique({ where: { id: factoryLocationId } }),
      prisma.poolModel.findUnique({ where: { id: poolModelId } }),
      prisma.color.findUnique({ where: { id: colorId } }), // <-- Color (no PoolColor)
    ])
    if (!dealer)  return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
    if (!factory) return NextResponse.json({ message: 'Factory location not found' }, { status: 404 })
    if (!poolModel) return NextResponse.json({ message: 'Pool model not found' }, { status: 404 })
    if (!color)    return NextResponse.json({ message: 'Color not found' }, { status: 404 })

    // Guardar archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const uploadDir = path.join(process.cwd(), 'public/uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    await fs.writeFile(path.join(uploadDir, filename), buffer)
    const paymentProofUrl = `/uploads/${filename}`

    // Crear orden
    const newOrder = await prisma.order.create({
      data: {
        poolModelId,
        colorId,
        factoryLocationId,
        dealerId,
        notes,
        deliveryAddress,
        paymentProofUrl,
        status: 'PENDING_PAYMENT_APPROVAL',
      },
      include: {
        poolModel: { select: { name: true } },
        color:     { select: { name: true } },
        dealer:    { select: { name: true } },
      },
    })

    return NextResponse.json({ message: '✅ Order created', order: newOrder }, { status: 201 })
  } catch (error) {
    console.error('Order creation error:', error)
    return NextResponse.json({ message: '❌ Internal server error' }, { status: 500 })
  }
}