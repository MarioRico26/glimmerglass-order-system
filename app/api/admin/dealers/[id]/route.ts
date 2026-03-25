// app/api/admin/dealers/[id]/route.ts
import { AdminModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdminAccess(AdminModule.DEALERS)

    const dealerId = params.id
    const { approved, workflowProfileId } = await req.json() as { approved?: boolean; workflowProfileId?: string | null }

    const hasApproved = typeof approved === 'boolean'
    const normalizedWorkflowProfileId =
      typeof workflowProfileId === 'string' && workflowProfileId.trim()
        ? workflowProfileId.trim()
        : workflowProfileId === null
        ? null
        : undefined

    if (!hasApproved && normalizedWorkflowProfileId === undefined) {
      return NextResponse.json({ message: 'Invalid body' }, { status: 400 })
    }

    if (normalizedWorkflowProfileId !== undefined && normalizedWorkflowProfileId !== null) {
      const profile = await prisma.workflowProfile.findUnique({
        where: { id: normalizedWorkflowProfileId },
        select: { id: true },
      })
      if (!profile) {
        return NextResponse.json({ message: 'Invalid workflow profile' }, { status: 400 })
      }
    }

    if (hasApproved) {
      const user = await prisma.user.findFirst({ where: { dealerId } })
      if (!user) {
        return NextResponse.json({ message: 'User for dealer not found' }, { status: 404 })
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { approved },
      })
    }

    if (normalizedWorkflowProfileId !== undefined) {
      await prisma.dealer.update({
        where: { id: dealerId },
        data: { workflowProfileId: normalizedWorkflowProfileId },
      })
    }

    // (opcional) devolver el dealer “refrescado” para actualizar UI sin refetch
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        workflowProfileId: true,
        workflowProfile: {
          select: { id: true, name: true, slug: true },
        },
        agreementUrl: true,
        User: { select: { approved: true } },
      },
    })

    return NextResponse.json({
      ok: true,
      dealer: dealer ? {
        id: dealer.id,
        name: dealer.name,
        email: dealer.email,
        phone: dealer.phone ?? '',
        city: dealer.city ?? '',
        state: dealer.state ?? '',
        workflowProfileId: dealer.workflowProfileId ?? null,
        workflowProfileName: dealer.workflowProfile?.name ?? null,
        approved: dealer.User?.approved ?? false,
        agreementUrl: dealer.agreementUrl ?? null,
      } : null
    }, { status: 200 })
  } catch (error) {
    console.error('Error updating dealer approval:', error)
    const status = typeof error === 'object' && error !== null && 'status' in error && typeof (error as any).status === 'number' ? (error as any).status : 500
    const message = typeof error === 'object' && error !== null && 'message' in error && typeof (error as any).message === 'string' ? (error as any).message : 'Internal server error'
    return NextResponse.json({ message }, { status })
  }
}
