// glimmerglass-order-system/app/api/admin/orders/[id]/status/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { OrderDocType, Role } from '@prisma/client'

type FlowStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'APPROVED' // (eventually removed)
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

const FLOW_ORDER: FlowStatus[] = [
  'PENDING_PAYMENT_APPROVAL',
  'APPROVED',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
]

const REQUIRED_FOR: Partial<Record<FlowStatus, OrderDocType[]>> = {
  // Pending -> Approved (Mike)
  APPROVED: ['PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE'],

  // Approved -> In Production (Mike)
  IN_PRODUCTION: ['BUILD_SHEET', 'POST_PRODUCTION_MEDIA'],

  // In Production -> Pre-Shipping (Mike)
  PRE_SHIPPING: [
    'SHIPPING_CHECKLIST',
    'PRE_SHIPPING_MEDIA',
    'BILL_OF_LADING',
    'PROOF_OF_FINAL_PAYMENT',
    'PAID_INVOICE',
  ],
}

// Mike: Serial Number required to move to In Production (and keep it for later stages too)
const REQUIRED_FIELDS_FOR: Partial<Record<FlowStatus, Array<'serialNumber'>>> = {
  IN_PRODUCTION: ['serialNumber'],
  PRE_SHIPPING: ['serialNumber'],
  COMPLETED: ['serialNumber'],
}

function json(message: string, status = 400, extra?: Record<string, any>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
async function getOrderId(ctx: Ctx) {
  const p: any = ctx.params
  return ('then' in p ? (await p).id : p.id) as string
}

function isAdminRole(role: any) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

function flowIndex(s: FlowStatus) {
  return FLOW_ORDER.indexOf(s)
}

function isForwardMove(from: FlowStatus, to: FlowStatus) {
  if (to === 'CANCELED') return false
  const a = flowIndex(from)
  const b = flowIndex(to)
  if (a === -1 || b === -1) return false
  return b > a
}

async function getOrderSummary(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      deliveryAddress: true,
      status: true,
      paymentProofUrl: true,

      shippingMethod: true,
      requestedShipDate: true,
      serialNumber: true,
      productionPriority: true,

      hardwareSkimmer: true,
      hardwareReturns: true,
      hardwareAutocover: true,
      hardwareMainDrains: true,

      dealer: {
        select: { name: true, email: true, phone: true, address: true, city: true, state: true },
      },
      poolModel: { select: { name: true } },
      color: { select: { name: true } },
      factoryLocation: { select: { id: true, name: true } },
    },
  })

  if (!order) return null

  return {
    id: order.id,
    deliveryAddress: order.deliveryAddress,
    status: order.status,
    paymentProofUrl: order.paymentProofUrl ?? null,

    dealer: order.dealer ?? null,
    poolModel: order.poolModel ?? null,
    color: order.color ?? null,

    factory: order.factoryLocation
      ? { id: order.factoryLocation.id, name: order.factoryLocation.name }
      : null,

    shippingMethod: order.shippingMethod ?? null,
    requestedShipDate: order.requestedShipDate ? order.requestedShipDate.toISOString() : null,
    serialNumber: order.serialNumber ?? null,
    productionPriority:
      typeof order.productionPriority === 'number' ? order.productionPriority : null,

    hardwareSkimmer: !!order.hardwareSkimmer,
    hardwareReturns: !!order.hardwareReturns,
    hardwareAutocover: !!order.hardwareAutocover,
    hardwareMainDrains: !!order.hardwareMainDrains,
  }
}

type MissingResult =
  | { ok: true; missingDocs: OrderDocType[]; missingFields: string[] }
  | { ok: false; notFound: true }

async function getMissingForTarget(orderId: string, targetStatus: FlowStatus): Promise<MissingResult> {
  const needDocs = REQUIRED_FOR[targetStatus] ?? []
  const needFields = REQUIRED_FIELDS_FOR[targetStatus] ?? []

  if (needDocs.length === 0 && needFields.length === 0) {
    return { ok: true, missingDocs: [], missingFields: [] }
  }

  const [order, media] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, serialNumber: true },
    }),
    needDocs.length
      ? prisma.orderMedia.findMany({
          where: { orderId, docType: { in: needDocs } },
          select: { docType: true },
        })
      : Promise.resolve([] as Array<{ docType: OrderDocType | null }>),
  ])

  if (!order) return { ok: false, notFound: true }

  const present = new Set(media.map((m) => m.docType).filter(Boolean) as OrderDocType[])
  const missingDocs = needDocs.filter((d) => !present.has(d))

  const missingFields: string[] = []
  for (const f of needFields) {
    if (f === 'serialNumber' && !order.serialNumber) missingFields.push('serialNumber')
  }

  return { ok: true, missingDocs, missingFields }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const orderId = await getOrderId(ctx)
    const summary = await getOrderSummary(orderId)
    if (!summary) return json('Order not found', 404)

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/orders/[id]/status error:', e)
    return json('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const orderId = await getOrderId(ctx)
    const body = await req.json().catch(() => null)

    const nextStatus = (body?.status as FlowStatus | undefined) ?? undefined
    const comment = (body?.comment as string | undefined) ?? ''

    if (!nextStatus) return json('Missing status', 400)

    const current = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    })
    if (!current) return json('Order not found', 404)

    const currentStatus = current.status as FlowStatus

    if (isForwardMove(currentStatus, nextStatus)) {
      const missing = await getMissingForTarget(orderId, nextStatus)
      if (!missing.ok) return json('Order not found', 404)

      if (missing.missingDocs.length || missing.missingFields.length) {
        return json('Missing required documents/fields to move forward', 400, {
          code: 'MISSING_REQUIREMENTS',
          targetStatus: nextStatus,
          missing: {
            docs: missing.missingDocs,
            fields: missing.missingFields,
          },
        })
      }
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    })
    if (!dbUser) return json('User not found', 404)

    const finalComment = comment?.trim() || 'Status changed'

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus as any },
      })

      await tx.orderHistory.create({
        data: {
          orderId,
          status: nextStatus as any,
          comment: finalComment,
          userId: dbUser.id,
        },
      })
    })

    const summary = await getOrderSummary(orderId)
    if (!summary) return json('Order not found', 404)

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/orders/[id]/status error:', e)
    return json('Internal server error', 500)
  }
}