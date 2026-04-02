// glimmerglass-order-system/app/api/admin/orders/[id]/approve/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { getStatusRequirements, listPresentOrderDocumentKeys } from '@/lib/orderRequirements'

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...(extra ?? {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireRole(['ADMIN', 'SUPERADMIN'])
    const id = params.id
    const email = (session?.user as { email?: string } | undefined)?.email
    if (!email) return json('Unauthorized', 401)

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        paymentProofUrl: true,
        serialNumber: true,
        requestedShipDate: true,
        productionPriority: true,
        dealer: {
          select: {
            workflowProfileId: true,
          },
        },
      },
    })
    if (!order) return json('Order not found', 404)
    if (order.status !== 'PENDING_PAYMENT_APPROVAL') {
      return json('Only pending orders can be moved into production', 400)
    }

    const requirements = await getStatusRequirements('IN_PRODUCTION', order.dealer?.workflowProfileId ?? null)

    const present = await listPresentOrderDocumentKeys(id)
    if (order.paymentProofUrl) {
      present.add('PROOF_OF_PAYMENT')
    }

    const missingDocs = requirements.requiredDocs.filter((d) => !present.has(d))

    const missingFields: string[] = []
    for (const f of requirements.requiredFields) {
      if (f === 'serialNumber' && !order.serialNumber) missingFields.push('serialNumber')
      if (f === 'requestedShipDate' && !order.requestedShipDate) missingFields.push('requestedShipDate')
      if (f === 'productionPriority' && typeof order.productionPriority !== 'number') {
        missingFields.push('productionPriority')
      }
    }

    if (missingDocs.length || missingFields.length) {
      return json('Missing required documents/fields to enter production', 400, {
        code: 'MISSING_REQUIREMENTS',
        targetStatus: 'IN_PRODUCTION',
        missing: { docs: missingDocs, fields: missingFields },
      })
    }

    const actor = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
    if (!actor) return json('User not found', 404)

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.order.update({
        where: { id },
        data: { status: 'IN_PRODUCTION' },
      })
      await tx.orderHistory.create({
        data: {
          orderId: id,
          status: 'IN_PRODUCTION',
          comment: 'Payment proof approved by admin; order moved to In Production',
          userId: actor.id,
        },
      })
      return next
    })

    return NextResponse.json(updated, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('PATCH /api/admin/orders/[id]/approve error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
