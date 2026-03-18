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
    notes: o.notes ?? null,
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
    const session = await requireRole(['ADMIN', 'SUPERADMIN'])
    const { id } = params

    const body = await req.json().catch(() => ({} as any))

    const {
      factoryLocationId,
      shippingMethod,
      deliveryAddress,
      notes,
      requestedShipDate,
      serialNumber,
      productionPriority,
    } = body as {
      factoryLocationId?: string | null
      shippingMethod?: string | null
      deliveryAddress?: string | null
      notes?: string | null
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

    if (typeof deliveryAddress === 'string') {
      const trimmedDeliveryAddress = deliveryAddress.trim()
      if (!trimmedDeliveryAddress) {
        return NextResponse.json({ message: 'Delivery address is required' }, { status: 400 })
      }
      data.deliveryAddress = trimmedDeliveryAddress
    }

    if (typeof notes === 'string' || notes === null) {
      data.notes = typeof notes === 'string' ? notes.trim() || null : null
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

    const userEmail =
      session?.user && typeof session.user === 'object' && 'email' in session.user
        ? (session.user as { email?: string | null }).email
        : null

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
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

      if (userEmail) {
        const user = await tx.user.findUnique({
          where: { email: userEmail },
          select: { id: true },
        })

        if (user) {
          await tx.orderHistory.create({
            data: {
              orderId: id,
              status: order.status,
              comment: 'Order inputs updated by admin',
              userId: user.id,
            },
          })
        }
      }

      return order
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
