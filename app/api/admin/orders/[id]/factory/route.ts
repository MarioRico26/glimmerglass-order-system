// app/api/admin/orders/[id]/factory/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { parseDateOnlyToUtcNoon } from '@/lib/dateOnly'

function toSummaryDTO(o: any) {
  return {
    id: o.id,
    deliveryAddress: o.deliveryAddress,
    status: o.status,
    paymentProofUrl: o.paymentProofUrl ?? null,
    penetrationMode: o.penetrationMode,
    penetrationNotes: o.penetrationNotes ?? null,
    poolModel: o.poolModel
      ? {
          name: o.poolModel.name,
          blueprintUrl: o.poolModel.blueprintUrl ?? null,
          hasIntegratedSpa: !!o.poolModel.hasIntegratedSpa,
        }
      : null,
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
    job: o.job
      ? {
          id: o.job.id,
          role: o.jobRole ?? null,
          itemType: o.jobItemType ?? null,
          linkedOrders: Array.isArray(o.job.orders)
            ? o.job.orders
                .filter((linked: any) => linked.id !== o.id)
                .map((linked: any) => ({
                  id: linked.id,
                  status: linked.status,
                  role: linked.jobRole ?? null,
                  itemType: linked.jobItemType ?? null,
                  poolModel: linked.poolModel ? { name: linked.poolModel.name } : null,
                  color: linked.color ? { name: linked.color.name } : null,
                }))
            : [],
        }
      : null,
    shippingMethod: o.shippingMethod ?? null,
    notes: o.notes ?? null,
    hardwareSkimmer: o.hardwareSkimmer,
    hardwareReturns: o.hardwareReturns,
    hardwareAutocover: o.hardwareAutocover,
    hardwareMainDrains: o.hardwareMainDrains,
    requestedShipDate: o.requestedShipDate,
    requestedShipAsap: !!o.requestedShipAsap,
    serialNumber: o.serialNumber,
    invoiceNumber: o.invoiceNumber ?? null,
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
      requestedShipAsap,
      serialNumber,
      invoiceNumber,
      productionPriority,
      penetrationMode,
      penetrationNotes,
      hardwareAutocover,
    } = body as {
      factoryLocationId?: string | null
      shippingMethod?: string | null
      deliveryAddress?: string | null
      notes?: string | null
      requestedShipDate?: string | null
      requestedShipAsap?: boolean | null
      serialNumber?: string | null
      invoiceNumber?: string | null
      productionPriority?: number | null
      penetrationMode?: string | null
      penetrationNotes?: string | null
      hardwareAutocover?: boolean | null
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
      const d = parseDateOnlyToUtcNoon(requestedShipDate)
      if (!d) {
        return NextResponse.json({ message: 'Invalid requested ship date' }, { status: 400 })
      }
      data.requestedShipDate = d
    } else if (requestedShipDate === null) {
      data.requestedShipDate = null
    }

    if (typeof requestedShipAsap === 'boolean') {
      data.requestedShipAsap = requestedShipAsap
    } else if (requestedShipAsap === null) {
      data.requestedShipAsap = false
    }

    if (typeof serialNumber === 'string' || serialNumber === null) {
      data.serialNumber = serialNumber || null
    }

    if (typeof invoiceNumber === 'string' || invoiceNumber === null) {
      data.invoiceNumber = typeof invoiceNumber === 'string' ? invoiceNumber.trim() || null : null
    }

    if (typeof productionPriority === 'number') {
      data.productionPriority = productionPriority
    } else if (productionPriority === null) {
      data.productionPriority = null
    }

    if (
      penetrationMode === 'PENETRATIONS_WITH_INSTALL' ||
      penetrationMode === 'PENETRATIONS_WITHOUT_INSTALL' ||
      penetrationMode === 'NO_PENETRATIONS' ||
      penetrationMode === 'OTHER'
    ) {
      data.penetrationMode = penetrationMode
      if (penetrationMode === 'NO_PENETRATIONS') {
        data.blueprintMarkers = null
      }
    }

    if (typeof penetrationNotes === 'string' || penetrationNotes === null) {
      data.penetrationNotes = typeof penetrationNotes === 'string' ? penetrationNotes.trim() || null : null
    }

    if (typeof hardwareAutocover === 'boolean') {
      data.hardwareAutocover = hardwareAutocover
    } else if (hardwareAutocover === null) {
      data.hardwareAutocover = false
    }

    if (data.penetrationMode === 'OTHER' && !data.penetrationNotes) {
      return NextResponse.json(
        { message: 'Other penetration notes are required when penetration option is Other' },
        { status: 400 }
      )
    }

    const userEmail =
      session?.user && typeof session.user === 'object' && 'email' in session.user
        ? (session.user as { email?: string | null }).email
        : null

    const updated = await prisma.$transaction(async (tx) => {
      const base = await tx.order.findUnique({
        where: { id },
        select: {
          id: true,
          jobId: true,
          factoryLocationId: true,
          serialNumber: true,
          allocatedPoolStockId: true,
          allocatedPoolStock: {
            select: {
              id: true,
              serialNumber: true,
              factoryId: true,
            },
          },
        },
      })
      if (!base) throw new Error('Order not found')

      if (
        base.allocatedPoolStockId &&
        typeof data.factoryLocationId !== 'undefined' &&
        data.factoryLocationId !== base.factoryLocationId
      ) {
        throw Object.assign(new Error('Release the allocated stock before changing the factory location'), {
          status: 409,
        })
      }

      if (
        base.allocatedPoolStockId &&
        typeof data.serialNumber !== 'undefined' &&
        data.serialNumber !== (base.allocatedPoolStock?.serialNumber ?? base.serialNumber ?? null)
      ) {
        throw Object.assign(new Error('Release the allocated stock before editing the serial number'), {
          status: 409,
        })
      }

      const sharedJobData: Record<string, unknown> = {}
      if ('factoryLocationId' in data) sharedJobData.factoryLocationId = data.factoryLocationId
      if ('shippingMethod' in data) sharedJobData.shippingMethod = data.shippingMethod
      if ('deliveryAddress' in data) sharedJobData.deliveryAddress = data.deliveryAddress
      if ('requestedShipDate' in data) sharedJobData.requestedShipDate = data.requestedShipDate
      if ('requestedShipAsap' in data) sharedJobData.requestedShipAsap = data.requestedShipAsap

      if (base.jobId && Object.keys(sharedJobData).length > 0) {
        await tx.order.updateMany({
          where: { jobId: base.jobId },
          data: sharedJobData,
        })
      }

      await tx.order.update({
        where: { id },
        data,
      })

      const order = await tx.order.findUnique({
        where: { id },
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
          poolModel: { select: { name: true, blueprintUrl: true, hasIntegratedSpa: true } },
          color: { select: { name: true } },
          factoryLocation: { select: { id: true, name: true } },
          job: {
            select: {
              id: true,
              orders: {
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  status: true,
                  jobRole: true,
                  jobItemType: true,
                  poolModel: { select: { name: true } },
                  color: { select: { name: true } },
                },
              },
            },
          },
        },
      })
      if (!order) throw new Error('Order not found')

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
  } catch (e: unknown) {
    console.error('PATCH /api/admin/orders/[id]/factory error:', e)
    const status =
      typeof e === 'object' && e !== null && 'status' in e && typeof (e as any).status === 'number'
        ? (e as any).status
        : 500
    const message =
      typeof e === 'object' && e !== null && 'message' in e && typeof (e as any).message === 'string'
        ? (e as any).message
        : 'Internal Server Error'
    return NextResponse.json(
      { message },
      { status },
    )
  }
}
