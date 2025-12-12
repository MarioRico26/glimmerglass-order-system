// app/api/admin/orders/[id]/factory/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

function toSummaryDTO(o: any) {
  return {
    id: o.id,
    deliveryAddress: o.deliveryAddress,
    status: o.status,
    paymentProofUrl: o.paymentProofUrl ?? null,
    poolModel: o.poolModel ? { name: o.poolModel.name } : null,
    color: o.color ? { name: o.color.name } : null,
    dealer: o.dealer
      ? {
          name: o.dealer.name,
          email: o.dealer.email,
          phone: o.dealer.phone,
          address: o.dealer.address,
          city: o.dealer.city,
          state: o.dealer.state,
        }
      : null,
    factory: o.factoryLocation
      ? {
          id: o.factoryLocation.id,
          name: o.factoryLocation.name,
        }
      : null,
    shippingMethod: o.shippingMethod ?? null,
    hardwareSkimmer: o.hardwareSkimmer,
    hardwareReturns: o.hardwareReturns,
    hardwareAutocover: o.hardwareAutocover,
    hardwareMainDrains: o.hardwareMainDrains,
    requestedShipDate: o.requestedShipDate,
    serialNumber: o.serialNumber,
    productionPriority: o.productionPriority,
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])
    const { id } = params

    const body = await req.json().catch(() => ({} as any))

    const {
      factoryLocationId,
      shippingMethod,
      requestedShipDate,
      serialNumber,
      productionPriority,
    } = body as {
      factoryLocationId?: string | null
      shippingMethod?: string | null
      requestedShipDate?: string | null
      serialNumber?: string | null
      productionPriority?: number | null
    }

    const data: any = {}

    // factoryLocationId puede ser string, "", null
    if (factoryLocationId === null || factoryLocationId === '') {
      data.factoryLocationId = null
    } else if (typeof factoryLocationId === 'string') {
      data.factoryLocationId = factoryLocationId
    }

    if (typeof shippingMethod === 'string' || shippingMethod === null) {
      data.shippingMethod = shippingMethod
    }

    if (requestedShipDate) {
      const d = new Date(requestedShipDate)
      if (!isNaN(d.getTime())) {
        data.requestedShipDate = d
      }
    } else if (requestedShipDate === null) {
      data.requestedShipDate = null
    }

    if (typeof serialNumber === 'string' || serialNumber === null) {
      data.serialNumber = serialNumber || null
    }

    if (typeof productionPriority === 'number') {
      data.productionPriority = productionPriority
    } else if (productionPriority === null) {
      data.productionPriority = null
    }

    const updated = await prisma.order.update({
      where: { id },
      data,
      include: {
        dealer: {
          select: {
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
          },
        },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(toSummaryDTO(updated))
  } catch (e) {
    console.error('PATCH /api/admin/orders/[id]/factory error:', e)
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    )
  }
}