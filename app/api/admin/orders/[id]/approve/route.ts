// glimmerglass-order-system/app/api/admin/orders/[id]/approve/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { OrderDocType } from '@prisma/client'

const REQUIRED_FOR_APPROVED: OrderDocType[] = ['PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE']

function json(message: string, status = 400, extra?: Record<string, any>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

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
    createdAt: o.createdAt ?? null,
  }
}

async function getMissingDocs(orderId: string, required: OrderDocType[]) {
  if (!required.length) return [] as OrderDocType[]

  const media = await prisma.orderMedia.findMany({
    where: { orderId, docType: { in: required } },
    select: { docType: true },
  })

  const present = new Set(media.map((m) => m.docType).filter(Boolean) as OrderDocType[])
  return required.filter((d) => !present.has(d))
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // ✅ auth
    const sessionUser = await requireRole(['ADMIN', 'SUPERADMIN'])
    const userEmail = (sessionUser as any)?.email
    if (!userEmail) return json('Unauthorized', 401)

    const orderId = params.id

    // ✅ ensure order exists + grab current status
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    })
    if (!order) return json('Order not found', 404)

    // ✅ gate: docs required to move into APPROVED
    const missingDocs = await getMissingDocs(orderId, REQUIRED_FOR_APPROVED)
    if (missingDocs.length) {
      return json('Missing required documents to approve', 400, {
        code: 'MISSING_REQUIREMENTS',
        targetStatus: 'APPROVED',
        missing: { docs: missingDocs, fields: [] },
      })
    }

    // ✅ find db user for history
    const dbUser = await prisma.user.findUnique({
      where: { email: userEmail },
      select: { id: true },
    })
    if (!dbUser) return json('User not found', 404)

    // ✅ transaction: update status + create timeline entry
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({
        where: { id: orderId },
        data: { status: 'APPROVED' },
        include: {
          poolModel: { select: { name: true } },
          color: { select: { name: true } },
          dealer: { select: { name: true } },
          factoryLocation: { select: { name: true } },
        },
      })

      await tx.orderHistory.create({
        data: {
          orderId,
          status: 'APPROVED',
          comment: 'Approved from Orders list',
          userId: dbUser.id,
        },
      })

      return u
    })

    return NextResponse.json(toOrderDTO(updated), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e: any) {
    console.error('PATCH /api/admin/orders/[id]/approve error:', e)
    return json('Internal Server Error', 500)
  }
}