export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Role } from '@prisma/client'
import { authOptions } from '@/lib/authOptions'
import {
  REQUIREMENT_FIELD_KEYS,
  STATUS_LABELS,
  WORKFLOW_DOC_OPTIONS,
  type FlowStatus,
} from '@/lib/orderFlow'
import {
  TEMPLATE_STATUSES,
  isTemplateStatus,
  listTemplateRequirements,
  resetStatusRequirements,
  sanitizeRequirementDocs,
  sanitizeRequirementFields,
  upsertStatusRequirements,
} from '@/lib/orderRequirements'
import { listWorkflowDocConfigs, upsertWorkflowDocLabels } from '@/lib/workflowDocConfig'

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

function isAdminRole(role: unknown) {
  return role === Role.ADMIN || role === Role.SUPERADMIN
}

async function optionsPayload() {
  const docConfigs = await listWorkflowDocConfigs()
  const docMap = new Map(docConfigs.map((item) => [item.docType, item] as const))

  return {
    statuses: TEMPLATE_STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABELS[status as FlowStatus] || status.replaceAll('_', ' '),
    })),
    docs: WORKFLOW_DOC_OPTIONS.map((d) => ({
      value: d,
      label: docMap.get(d)?.label || d,
      sortOrder: docMap.get(d)?.sortOrder ?? 0,
      source: docMap.get(d)?.source || 'default',
    })),
    fields: REQUIREMENT_FIELD_KEYS.map((f) => ({ value: f })),
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string; role?: unknown } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const [items, options] = await Promise.all([listTemplateRequirements(), optionsPayload()])
    return NextResponse.json(
      { items, options },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/admin/order-flow/requirements error:', e)
    return json('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string; role?: unknown } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const body = (await req.json().catch(() => null)) as
      | { docs?: Array<{ docType?: unknown; label?: unknown; sortOrder?: unknown }> }
      | null

    const docs = Array.isArray(body?.docs) ? body.docs : []
    const items = await upsertWorkflowDocLabels(docs)
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/order-flow/requirements error:', e)
    return json(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string; role?: unknown } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const body = (await req.json().catch(() => null)) as
      | { status?: unknown; requiredDocs?: unknown; requiredFields?: unknown }
      | null

    const statusRaw = typeof body?.status === 'string' ? body.status : ''
    if (!isTemplateStatus(statusRaw)) {
      return json('Invalid status', 400)
    }

    const requiredDocs = sanitizeRequirementDocs(body?.requiredDocs)
    const requiredFields = sanitizeRequirementFields(body?.requiredFields)

    const item = await upsertStatusRequirements(statusRaw, requiredDocs, requiredFields)
    return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PUT /api/admin/order-flow/requirements error:', e)
    return json('Internal server error', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string; role?: unknown } | undefined
    if (!user?.email) return json('Unauthorized', 401)
    if (!isAdminRole(user.role)) return json('Forbidden', 403)

    const statusRaw = req.nextUrl.searchParams.get('status') || ''
    if (!isTemplateStatus(statusRaw)) {
      return json('Invalid status', 400)
    }

    const item = await resetStatusRequirements(statusRaw)
    return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('DELETE /api/admin/order-flow/requirements error:', e)
    return json('Internal server error', 500)
  }
}
