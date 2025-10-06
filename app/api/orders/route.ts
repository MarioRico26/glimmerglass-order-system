// glimmerglass-order-system/app/api/orders/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()

    const poolModelId     = formData.get('poolModelId')?.toString() || ''
    const colorId         = formData.get('colorId')?.toString() || ''
    const dealerId        = formData.get('dealerId')?.toString() || ''
    const notes           = formData.get('notes')?.toString() || ''
    const deliveryAddress = formData.get('deliveryAddress')?.toString() || ''
    const file            = formData.get('paymentProof') as File | null

    // 🔽 nuevos campos booleanos (checkboxes)
    const hardwareSkimmer    = formData.get('hardwareSkimmer') === 'true'
    const hardwareAutocover  = formData.get('hardwareAutocover') === 'true'
    const hardwareReturns    = formData.get('hardwareReturns') === 'true'
    const hardwareMainDrains = formData.get('hardwareMainDrains') === 'true'

    // ⚠️ Ahora NO se pide factoryLocationId desde el front
    if (!dealerId || !file || !poolModelId || !colorId || !deliveryAddress) {
      return NextResponse.json({ message: 'Missing required fields.' }, { status: 400 })
    }

    // Validaciones de existencia
    const [dealer, poolModel, color] = await Promise.all([
      prisma.dealer.findUnique({ where: { id: dealerId } }),
      prisma.poolModel.findUnique({ where: { id: poolModelId } }),
      prisma.color.findUnique({ where: { id: colorId } }),
    ])
    if (!dealer)    return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
    if (!poolModel) return NextResponse.json({ message: 'Pool model not found' }, { status: 404 })
    if (!color)     return NextResponse.json({ message: 'Color not found' }, { status: 404 })

    // ✅ Buscar factory en backend (por ejemplo la primera o una lógica tuya)
    const factory = await prisma.factoryLocation.findFirst()
    if (!factory) {
      return NextResponse.json({ message: 'No default factory configured' }, { status: 500 })
    }

    // ✅ Subir el archivo a blob storage (no a disco)
    const buf = await file.arrayBuffer()
    const safeName = (file.name || 'payment-proof').replace(/[^a-zA-Z0-9_.-]/g, '_')
    const key = `orders/payment-proofs/${Date.now()}-${safeName}`

    const { url: paymentProofUrl } = await put(key, buf, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type || 'application/octet-stream',
    })

    // Crear orden
    const newOrder = await prisma.order.create({
      data: {
        poolModelId,
        colorId,
        factoryLocationId: factory.id, // asignado en backend automáticamente
        dealerId,
        notes,
        deliveryAddress,
        paymentProofUrl,
        status: 'PENDING_PAYMENT_APPROVAL',

        // ✅ nuevos campos booleanos
        hardwareSkimmer,
        hardwareAutocover,
        hardwareReturns,
        hardwareMainDrains,
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