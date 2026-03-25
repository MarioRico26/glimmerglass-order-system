// app/api/admin/dealers/overview/route.ts
import { AdminModule } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function GET() {
    try {
    await requireAdminAccess(AdminModule.DEALERS)

    // 1) Traemos dealers sin include
    const dealers = await prisma.dealer.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            workflowProfile: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    })

    const workflowProfiles = await prisma.workflowProfile.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            slug: true,
        },
    })

    // 2) Traemos los usuarios "owner" (role DEALER) para esos dealers en un solo query
    const dealerIds = dealers.map(d => d.id)
    const owners = await prisma.user.findMany({
        where: {
            role: 'DEALER',
            dealerId: { in: dealerIds },
        },
        select: {
            id: true,
            email: true,
            approved: true,
            role: true,
            dealerId: true,
        },
    })

    // 3) Index por dealerId
    const ownerByDealerId = new Map<string, typeof owners[number]>()
    for (const u of owners) {
        // si tienes más de un user por dealer, aquí decides cuál es "owner"
        // ahora mismo, el primero que aparezca
        if (!ownerByDealerId.has(u.dealerId!)) {
            ownerByDealerId.set(u.dealerId!, u)
        }
    }

    // 4) Proyectamos
    const rows = dealers.map(d => {
        const owner = ownerByDealerId.get(d.id) ?? null
        const approved = owner?.approved ?? false
        const hasSigned = Boolean(d.agreementSignedAt)
        let onboardingStatus: 'PENDING_APPROVAL' | 'APPROVED_WAITING_SIGNATURE' | 'ACTIVE'

        if (!approved) onboardingStatus = 'PENDING_APPROVAL'
        else if (approved && !hasSigned) onboardingStatus = 'APPROVED_WAITING_SIGNATURE'
        else onboardingStatus = 'ACTIVE'

        return {
            id: d.id,
            name: d.name,
            email: d.email,
            city: d.city,
            state: d.state,
            createdAt: d.createdAt,
            hasLogin: Boolean(owner),
            approved,
            agreementSignedAt: d.agreementSignedAt,
            agreementUrl: d.agreementUrl,
            onboardingStatus,
            workflowProfileId: d.workflowProfile?.id ?? null,
            workflowProfileName: d.workflowProfile?.name ?? null,
        }
    })

    const totals = {
        all: rows.length,
        pendingApproval: rows.filter(r => r.onboardingStatus === 'PENDING_APPROVAL').length,
        waitingSignature: rows.filter(r => r.onboardingStatus === 'APPROVED_WAITING_SIGNATURE').length,
        active: rows.filter(r => r.onboardingStatus === 'ACTIVE').length,
    }

    return NextResponse.json({ items: rows, totals, workflowProfiles })
    } catch (e: any) {
        return NextResponse.json({ message: e?.message || 'Internal server error' }, { status: e?.status || 500 })
    }
}
