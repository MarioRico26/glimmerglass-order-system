// glimmerglass-order-system/app/api/admin/orders/[id]/approve/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'
import { OrderDocType } from '@prisma/client'

const REQUIRED: OrderDocType[] = ['PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE']

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...(extra ?? {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireRole(['ADMIN', 'SUPERADMIN'])
    const id = params.id

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, paymentProofUrl: true },
    })
    if (!order) return json('Order not found', 404)

    const media = await prisma.orderMedia.findMany({
      where: { orderId: id, docType: { in: REQUIRED } },
      select: { docType: true },
    })

    const present = new Set(media.map((m) => m.docType).filter(Boolean) as OrderDocType[])
    if (order.paymentProofUrl) {
      present.add('PROOF_OF_PAYMENT')
    }
    const missingDocs = REQUIRED.filter((d) => !present.has(d))

    if (missingDocs.length) {
      return json('Missing required documents to approve', 400, {
        code: 'MISSING_REQUIREMENTS',
        targetStatus: 'APPROVED',
        missing: { docs: missingDocs, fields: [] },
      })
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: 'APPROVED' },
    })

    return NextResponse.json(updated, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    console.error('PATCH /api/admin/orders/[id]/approve error:', e)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
