// app/api/admin/orders/[id]/approve/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

function toOrderDTO(o: any) {
  return {
    id: o.id,
    deliveryAddress: o.deliveryAddress,
    status: o.status,
    paymentProofUrl: o.paymentProofUrl ?? null,
    poolModel: o.poolModel ? { name: o.poolModel.name } : null,
    color: o.color ? { name: o.color.name } : null,
    dealer: o.dealer ? { name: o.dealer.name } : null,
    factory: o.factoryLocation ? { name: o.factoryLocation.name } : null,
  }
}

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])
    const { id } = params

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        dealer: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      },
    })

    // (opcional) historial:
    // await prisma.orderHistory.create({ data: { orderId: id, status: 'APPROVED', userId: ... } })

    return NextResponse.json(toOrderDTO(updated), { status: 200 })
  } catch (e: any) {
    console.error('PATCH /api/admin/orders/[id]/approve error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}