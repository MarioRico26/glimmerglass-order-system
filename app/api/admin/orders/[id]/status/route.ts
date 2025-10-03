import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { auditLog } from '@/lib/audit'
import { AuditAction } from '@prisma/client'
import { sendEmail } from '@/lib/mailer'

// ✅ DTO para retornar orden
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
    createdAt: o.createdAt,

    // ✅ Nuevos campos visibles
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
        dealer: { select: { name: true } },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { name: true } },
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
      | 'COMPLETED'
      | 'CANCELED'
    const note: string | undefined = body?.note

    if (!status) {
      return NextResponse.json({ message: 'Missing status' }, { status: 400 })
    }

    const current = await prisma.order.findUnique({
      where: { id },
      include: {
        dealer: { select: { id: true, name: true, email: true } },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      },
    })

    if (!current) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        dealer: { select: { id: true, name: true, email: true } },
        poolModel: { select: { name: true } },
        color: { select: { name: true } },
        factoryLocation: { select: { name: true } },
      },
    })

    try {
      await prisma.orderHistory.create({
        // @ts-ignore
        data: {
          orderId: id,
          // @ts-ignore
          status,
          // @ts-ignore
          note: note ?? `Status changed to ${status}`,
          // @ts-ignore
          userId: actor?.id ?? null,
        },
      })
    } catch (e) {
      console.warn('orderHistory create skipped:', (e as any)?.message)
    }

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

    await auditLog({
      action: AuditAction.ORDER_STATUS_CHANGED,
      message: `Status of order ${updated.id} → ${status}`,
      actor: { id: actor?.id, email: actor?.email, role: actor?.role },
      dealerId: updated.dealer?.id ?? null,
      orderId: updated.id,
      meta: { prev: current.status, next: status, note: note || null },
    })

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