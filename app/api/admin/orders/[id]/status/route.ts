// glimmerglass-order-system/app/api/admin/orders/[id]/status/route.ts
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import { Role, OrderDocType, type OrderStatus } from '@prisma/client'
import { getStatusRequirements } from '@/lib/orderRequirements'

import {
  FLOW_ORDER,
  labelOrderStatus,
  normalizeOrderStatus,
  type FlowStatus,
  type OrderDocTypeKey,
  type RequirementFieldKey,
} from '@/lib/orderFlow'

type Ctx = { params: { id: string } } | { params: Promise<{ id: string }> }
type SessionUser = { email?: string | null; role?: unknown }
const FLOW_STATUSES: FlowStatus[] = [...FLOW_ORDER, 'CANCELED']
type BlueprintMarkerType = 'skimmer' | 'return' | 'drain'
type BlueprintMarker = { type: BlueprintMarkerType; x: number; y: number }

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

async function getOrderId(ctx: Ctx) {
  const params = await Promise.resolve(ctx.params)
  return params.id
}

function isAdminRole(role: unknown) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

function flowIndex(s: FlowStatus) {
  // FLOW_ORDER no incluye CANCELED, por eso puede retornar -1
  if (s === 'CANCELED') return -1
  return FLOW_ORDER.indexOf(s)
}

function isFlowStatus(value: string): value is FlowStatus {
  return FLOW_STATUSES.includes(value as FlowStatus)
}

function isForwardMove(from: FlowStatus, to: FlowStatus) {
  // ✅ Ahora FlowStatus incluye CANCELED, así que TS no se queja.
  if (to === 'CANCELED') return false
  const a = flowIndex(from)
  const b = flowIndex(to)
  if (a === -1 || b === -1) return false
  return b > a
}

function isOneStepForward(from: FlowStatus, to: FlowStatus) {
  if (to === 'CANCELED') return false
  const a = flowIndex(from)
  const b = flowIndex(to)
  if (a === -1 || b === -1) return false
  return b === a + 1
}

function normalizeBlueprintMarkers(raw: unknown): BlueprintMarker[] {
  if (!Array.isArray(raw)) return []

  const out: BlueprintMarker[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue

    const maybe = item as { type?: unknown; x?: unknown; y?: unknown }
    if (maybe.type !== 'skimmer' && maybe.type !== 'return' && maybe.type !== 'drain') continue
    if (typeof maybe.x !== 'number' || typeof maybe.y !== 'number') continue
    if (!Number.isFinite(maybe.x) || !Number.isFinite(maybe.y)) continue

    out.push({
      type: maybe.type,
      x: Math.max(0, Math.min(100, maybe.x)),
      y: Math.max(0, Math.min(100, maybe.y)),
    })
  }
  return out
}

async function getOrderSummary(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      deliveryAddress: true,
      status: true,
      paymentProofUrl: true,
      blueprintMarkers: true,

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
      poolModel: { select: { name: true, blueprintUrl: true } },
      color: { select: { name: true } },
      factoryLocation: { select: { id: true, name: true } },
    },
  })

  if (!order) return null

  return {
    id: order.id,
    deliveryAddress: order.deliveryAddress,
    status: normalizeOrderStatus(order.status)?.toString() ?? order.status,
    paymentProofUrl: order.paymentProofUrl ?? null,
    blueprintMarkers: normalizeBlueprintMarkers(order.blueprintMarkers),

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

type MissingCheckInput = { serialNumber?: string | null }
type MissingOk = {
  ok: true
  requiredDocs: OrderDocTypeKey[]
  requiredFields: RequirementFieldKey[]
  missingDocs: OrderDocTypeKey[]
  missingFields: string[]
}
type MissingNotFound = { ok: false; notFound: true }
type MissingResult = MissingOk | MissingNotFound

async function getMissingForTarget(
  orderId: string,
  targetStatus: FlowStatus,
  input?: MissingCheckInput
): Promise<MissingResult> {
  const reqConfig = await getStatusRequirements(targetStatus)
  const needDocs = reqConfig.requiredDocs
  const needFields = reqConfig.requiredFields

  if (needDocs.length === 0 && needFields.length === 0) {
    return {
      ok: true,
      requiredDocs: needDocs,
      requiredFields: needFields,
      missingDocs: [],
      missingFields: [],
    }
  }

  const [order, media] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        serialNumber: true,
        requestedShipDate: true,
        productionPriority: true,
        paymentProofUrl: true,
      },
    }),
    needDocs.length
      ? prisma.orderMedia.findMany({
          where: { orderId, docType: { in: needDocs as unknown as OrderDocType[] } },
          select: { docType: true },
        })
      : Promise.resolve([] as Array<{ docType: OrderDocType | null }>),
  ])

  if (!order) return { ok: false, notFound: true }

  const present = new Set(
    media.map((m) => m.docType).filter(Boolean) as OrderDocType[]
  )

  // Dealer order creation already requires payment proof.
  // If it exists on the order, treat PROOF_OF_PAYMENT as satisfied.
  if (order.paymentProofUrl) {
    present.add('PROOF_OF_PAYMENT')
  }

  const missingDocs = needDocs.filter((d) => !present.has(d as unknown as OrderDocType))

  const hasSerialOverride = input?.serialNumber !== undefined
  const serialForValidation = hasSerialOverride
    ? (input?.serialNumber ?? '')
    : (order.serialNumber ?? '')
  const missingFields: string[] = []
  for (const f of needFields) {
    if (f === 'serialNumber' && !serialForValidation) missingFields.push('serialNumber')
    if (f === 'requestedShipDate' && !order.requestedShipDate) missingFields.push('requestedShipDate')
    if (f === 'productionPriority' && typeof order.productionPriority !== 'number') {
      missingFields.push('productionPriority')
    }
  }

  return {
    ok: true,
    requiredDocs: needDocs,
    requiredFields: needFields,
    missingDocs,
    missingFields,
  }
}

/**
 * GET: summary usado por admin history page
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const orderId = await getOrderId(ctx)
    const summary = await getOrderSummary(orderId)
    if (!summary) return json('Order not found', 404)

    const targetStatusRaw = _req.nextUrl.searchParams.get('targetStatus')?.trim() || ''
    if (targetStatusRaw) {
      if (!isFlowStatus(targetStatusRaw)) {
        return json('Invalid targetStatus', 400)
      }

      const targetStatus = targetStatusRaw as FlowStatus
      const missing = await getMissingForTarget(orderId, targetStatus)
      if (!missing.ok) return json('Order not found', 404)

      const requiredDocs = missing.requiredDocs
      const requiredFields = missing.requiredFields
      const missingDocs = missing.missingDocs
      const missingFields = missing.missingFields
      const satisfiedDocs = requiredDocs.filter((d) => !missingDocs.includes(d))
      const satisfiedFields = requiredFields.filter((f) => !missingFields.includes(f))

      return NextResponse.json(
        {
          ...summary,
          requirements: {
            targetStatus,
            requiredDocs,
            requiredFields,
            missingDocs,
            missingFields,
            satisfiedDocs,
            satisfiedFields,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/admin/orders/[id]/status error:', e)
    return json('Internal server error', 500)
  }
}

/**
 * PATCH: cambiar status con gate de docs/campos
 * Body: { status: FlowStatus, comment?: string, serialNumber?: string | null }
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as SessionUser | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const orderId = await getOrderId(ctx)
    const body = await req.json().catch(() => null)

    const nextStatus = (body?.status as FlowStatus | undefined) ?? undefined
    const comment = (body?.comment as string | undefined) ?? ''
    const serialRaw = (body as { serialNumber?: unknown } | null)?.serialNumber
    const serialNumber =
      serialRaw === undefined
        ? undefined
        : serialRaw === null
        ? null
        : String(serialRaw).trim()

    if (!nextStatus) return json('Missing status', 400)
    if (!isFlowStatus(nextStatus)) return json('Invalid status', 400)
    if (typeof serialNumber === 'string' && serialNumber.length > 100) {
      return json('Serial number too long (max 100 chars)', 400)
    }

    const current = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    })
    if (!current) return json('Order not found', 404)

    const currentStatus = normalizeOrderStatus(current.status)
    if (!currentStatus) return json('Invalid current status', 400, { from: current.status })

    const trimmedComment = comment.trim()
    const isCancelMove = currentStatus !== 'CANCELED' && nextStatus === 'CANCELED'
    const isRestoreMove = currentStatus === 'CANCELED' && nextStatus !== 'CANCELED'

    if (isCancelMove && !trimmedComment) {
      return json('Cancellation reason is required', 400, {
        code: 'CANCEL_REASON_REQUIRED',
        from: currentStatus,
        to: nextStatus,
      })
    }

    if (isRestoreMove && !trimmedComment) {
      return json('Restore reason is required', 400, {
        code: 'RESTORE_REASON_REQUIRED',
        from: currentStatus,
        to: nextStatus,
      })
    }

    if (isForwardMove(currentStatus, nextStatus) && !isOneStepForward(currentStatus, nextStatus)) {
      const currentIdx = flowIndex(currentStatus)
      const expectedNext = currentIdx >= 0 ? FLOW_ORDER[currentIdx + 1] ?? null : null
      return json('Invalid status transition. Move one step at a time.', 400, {
        code: 'INVALID_TRANSITION',
        from: currentStatus,
        to: nextStatus,
        expectedNext,
      })
    }

    // Gate solo al mover forward
    if (isForwardMove(currentStatus, nextStatus)) {
      const missing = await getMissingForTarget(
        orderId,
        nextStatus,
        serialNumber === undefined ? undefined : { serialNumber }
      )
      if (!missing.ok) return json('Order not found', 404)

      if (missing.missingDocs.length || missing.missingFields.length) {
        const requiredDocs = missing.requiredDocs
        const requiredFields = missing.requiredFields
        return json('Missing required documents/fields to move forward', 400, {
          code: 'MISSING_REQUIREMENTS',
          targetStatus: nextStatus,
          required: {
            docs: requiredDocs,
            fields: requiredFields,
          },
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

    const finalComment = isCancelMove
      ? `Order canceled: ${trimmedComment}`
      : isRestoreMove
      ? `Order restored to ${labelOrderStatus(nextStatus)}: ${trimmedComment}`
      : trimmedComment || 'Status changed'

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus as OrderStatus,
          ...(serialNumber !== undefined ? { serialNumber: serialNumber || null } : {}),
        },
      })

      await tx.orderHistory.create({
        data: {
          orderId,
          status: nextStatus as OrderStatus,
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
