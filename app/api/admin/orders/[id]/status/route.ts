// app/api/admin/orders/[id]/status/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { auditLog } from '@/lib/audit'
import { AuditAction } from '@prisma/client'
import { sendEmail } from '@/lib/mailer'

// ✅ DTO para retornar orden al frontend admin
function toOrderDTO(o: any) {
  return {
    id: o.id,
    deliveryAddress: o.deliveryAddress,
    status: o.status,
    paymentProofUrl: o.paymentProofUrl ?? null,
    createdAt: o.createdAt,

    // Pool & color
    poolModel: o.poolModel ? { name: o.poolModel.name } : null,
    color: o.color ? { name: o.color.name } : null,

    // Dealer con info extendida
    dealer: o.dealer
      ? {
          id: o.dealer.id,
          name: o.dealer.name,
          email: o.dealer.email,
          phone: o.dealer.phone,
          address: o.dealer.address,
          city: o.dealer.city,
          state: o.dealer.state,
        }
      : null,

    // Factory
    factory: o.factoryLocation
      ? {
          id: o.factoryLocation.id,
          name: o.factoryLocation.name,
          city: o.factoryLocation.city,
          state: o.factoryLocation.state,
        }
      : null,

    // Campos nuevos del RFC
    shippingMethod: o.shippingMethod,
    requestedShipDate: o.requestedShipDate,
    serialNumber: o.serialNumber,
    productionPriority: o.productionPriority,

    // Hardware
    hardwareSkimmer: o.hardwareSkimmer,
    hardwareAutocover: o.hardwareAutocover,
    hardwareReturns: o.hardwareReturns,
    hardwareMainDrains: o.hardwareMainDrains,
  }
}

// ✅ GET: ver resumen de la orden
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])
    const { id } = params

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        dealer: {
          select: {
            id: true,
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
        factoryLocation: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(toOrderDTO(order))
  } catch (e) {
    console.error('GET /api/admin/orders/[id]/status error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}

// ✅ PATCH: cambiar estado y registrar historial, notificación, email, auditoría
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['ADMIN', 'SUPERADMIN'])
    const actor = session?.user as any

    const { id } = params
    const body = await req.json().catch(() => ({}))
    const status = body?.status as
      | 'PENDING_PAYMENT_APPROVAL'
      | 'APPROVED'
      | 'IN_PRODUCTION'
      | 'PRE_SHIPPING'
      | 'COMPLETED'
      | 'CANCELED'
    const note: string | undefined = body?.note

    if (!status) {
      return NextResponse.json({ message: 'Missing status' }, { status: 400 })
    }

    const current = await prisma.order.findUnique({
      where: { id },
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { id: true, name: true } },
      },
    })

    if (!current) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        dealer: {
          select: {
            id: true,
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
        factoryLocation: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
          },
        },
      },
    })

    // Historial (dejamos tu lógica original, solo limpiando un poco)
    try {
      await prisma.orderHistory.create({
        data: {
          orderId: id,
          status,
          comment: note ?? `Status changed to ${status}`,
          userId: actor?.id ?? current.id, // fallback cutre si actor.id no existe
        },
      })
    } catch (e) {
      console.warn('orderHistory create skipped:', (e as any)?.message)
    }

    // Notificación al dealer
    try {
      if (updated.dealer?.id) {
        await prisma.notification.create({
          data: {
            dealerId: updated.dealer.id,
            title: 'Order status updated',
            message: `Order ${updated.id} is now ${status.replaceAll('_', ' ')}`,
            orderId: updated.id,
          },
        })
      }
    } catch (e) {
      console.warn('notification create skipped:', (e as any)?.message)
    }

    // Audit log
    await auditLog({
      action: AuditAction.ORDER_STATUS_CHANGED,
      message: `Status of order ${updated.id} → ${status}`,
      actor: { id: actor?.id, email: actor?.email, role: actor?.role },
      dealerId: updated.dealer?.id ?? null,
      orderId: updated.id,
      meta: { prev: current.status, next: status, note: note || null },
    })

    // Email al dealer
    if (updated.dealer?.email) {
      await sendEmail({
        to: updated.dealer.email,
        subject: `Order ${updated.id} status: ${status.replaceAll('_', ' ')}`,
        html: `
          <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial">
            <h2>Order ${updated.id} update</h2>
            <p>Status is now <b>${status.replaceAll('_', ' ')}</b>.</p>
            ${note ? `<p><b>Note:</b> ${note}</p>` : ''}
          </div>
        `,
      })
    }

    return NextResponse.json(toOrderDTO(updated), { status: 200 })
  } catch (e: any) {
    console.error('PATCH /api/admin/orders/[id]/status error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}