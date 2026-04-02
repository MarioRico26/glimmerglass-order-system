export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { AdminModule } from '@prisma/client'

import {
  createWorkflowProfile,
  duplicateWorkflowProfile,
  renameWorkflowProfile,
} from '@/lib/orderRequirements'
import { requireAdminAccess } from '@/lib/adminAccess'

function json(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...(extra ?? {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)
    const body = (await req.json().catch(() => null)) as
      | { mode?: unknown; name?: unknown; sourceProfileId?: unknown }
      | null

    const mode = typeof body?.mode === 'string' ? body.mode : 'create'
    const name = typeof body?.name === 'string' ? body.name : ''

    if (mode === 'duplicate') {
      const sourceProfileId = typeof body?.sourceProfileId === 'string' ? body.sourceProfileId.trim() : ''
      if (!sourceProfileId) return json('sourceProfileId is required', 400)
      const profile = await duplicateWorkflowProfile(sourceProfileId, name)
      return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const profile = await createWorkflowProfile(name)
    return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('POST /api/admin/order-flow/profiles error:', e)
    return json(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminAccess(AdminModule.WORKFLOW_REQUIREMENTS)
    const body = (await req.json().catch(() => null)) as
      | { profileId?: unknown; name?: unknown }
      | null

    const profileId = typeof body?.profileId === 'string' ? body.profileId.trim() : ''
    const name = typeof body?.name === 'string' ? body.name : ''
    if (!profileId) return json('profileId is required', 400)

    const profile = await renameWorkflowProfile(profileId, name)
    return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('PATCH /api/admin/order-flow/profiles error:', e)
    return json(e instanceof Error ? e.message : 'Internal server error', 500)
  }
}
