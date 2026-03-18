export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getWorkflowDocLabelMap, listWorkflowDocConfigs } from '@/lib/workflowDocConfig'

function json(message: string, status = 400) {
  return NextResponse.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as { email?: string } | undefined
    if (!user?.email) return json('Unauthorized', 401)

    const [items, labels] = await Promise.all([listWorkflowDocConfigs(), getWorkflowDocLabelMap()])
    return NextResponse.json({ items, labels }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GET /api/workflow-doc-labels error:', error)
    return json('Internal server error', 500)
  }
}
