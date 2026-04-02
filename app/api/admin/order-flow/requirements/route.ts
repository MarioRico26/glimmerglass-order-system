export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'
import {
  REQUIREMENT_FIELD_KEYS,
  STATUS_LABELS,
  type FlowStatus,
} from '@/lib/orderFlow'
import {
  TEMPLATE_STATUSES,
  isTemplateStatus,
  listWorkflowProfiles,
  listTemplateRequirements,
  resetStatusRequirements,
  sanitizeRequirementDocs,
  sanitizeRequirementFields,
  upsertStatusRequirements,
} from '@/lib/orderRequirements'
import {
  createWorkflowDocumentDefinition,
  listWorkflowDocConfigs,
  upsertWorkflowDocLabels,
} from '@/lib/workflowDocConfig'
import { requireAdminAccess } from '@/lib/adminAccess'

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { message, ...(extra ?? {}) },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

async function optionsPayload() {
  const docConfigs = await listWorkflowDocConfigs()
  const profiles = await listWorkflowProfiles()

  return {
    profiles: profiles.map((profile) => ({
      id: profile.id,
      slug: profile.slug,
      name: profile.name,
      dealerCount: profile.dealerCount,
      dealerNames: profile.dealerNames,
    })),
    statuses: TEMPLATE_STATUSES.map((status) => ({
      value: status,
      label: STATUS_LABELS[status as FlowStatus] || status.replaceAll('_', ' '),
    })),
    docs: docConfigs.map((d) => ({
      id: d.id,
      value: d.key,
      key: d.key,
      label: d.label,
      sortOrder: d.sortOrder ?? 0,
      source: d.source,
      legacyDocType: d.legacyDocType,
      visibleToDealerDefault: d.visibleToDealerDefault,
    })),
    fields: REQUIREMENT_FIELD_KEYS.map((f) => ({ value: f })),
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)
    const profileId = req.nextUrl.searchParams.get('profileId') || null

    const [items, options] = await Promise.all([listTemplateRequirements(profileId), optionsPayload()])
    return NextResponse.json(
      { items, options, selectedProfileId: profileId },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e) {
    console.error('GET /api/admin/order-flow/requirements error:', e)
    return json('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)

    const body = (await req.json().catch(() => null)) as
      | {
          docs?: Array<{
            key?: unknown
            docType?: unknown
            label?: unknown
            sortOrder?: unknown
            visibleToDealerDefault?: unknown
          }>
        }
      | null

    const docs = Array.isArray(body?.docs) ? body.docs : []
    const items = await upsertWorkflowDocLabels(docs)
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/order-flow/requirements error:', e)
    return json(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)

    const body = (await req.json().catch(() => null)) as
      | { label?: unknown; visibleToDealerDefault?: unknown }
      | null

    const item = await createWorkflowDocumentDefinition({
      label: body?.label,
      visibleToDealerDefault: body?.visibleToDealerDefault,
    })

    return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('POST /api/admin/order-flow/requirements error:', e)
    return json(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)

    const body = (await req.json().catch(() => null)) as
      | { status?: unknown; requiredDocs?: unknown; requiredFields?: unknown; profileId?: unknown }
      | null

    const statusRaw = typeof body?.status === 'string' ? body.status : ''
    if (!isTemplateStatus(statusRaw)) {
      return json('Invalid status', 400)
    }

    const requiredDocs = sanitizeRequirementDocs(body?.requiredDocs)
    const requiredFields = sanitizeRequirementFields(body?.requiredFields)
    const profileId = typeof body?.profileId === 'string' && body.profileId.trim() ? body.profileId.trim() : null

    const item = await upsertStatusRequirements(statusRaw, requiredDocs, requiredFields, profileId)
    return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PUT /api/admin/order-flow/requirements error:', e)
    return json('Internal server error', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)

    const statusRaw = req.nextUrl.searchParams.get('status') || ''
    const profileId = req.nextUrl.searchParams.get('profileId') || null
    if (!isTemplateStatus(statusRaw)) {
      return json('Invalid status', 400)
    }

    const item = await resetStatusRequirements(statusRaw, profileId)
    return NextResponse.json(item, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('DELETE /api/admin/order-flow/requirements error:', e)
    return json('Internal server error', 500)
  }
}
