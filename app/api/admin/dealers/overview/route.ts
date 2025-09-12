// app/api/admin/dealers/overview/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role

    if (!session || (role !== 'ADMIN' && role !== 'SUPERADMIN')) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // 1) Traemos dealers sin include
    const dealers = await prisma.dealer.findMany({
        orderBy: { createdAt: 'desc' },
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
            approved,
            agreementSignedAt: d.agreementSignedAt,
            agreementUrl: d.agreementUrl,
            onboardingStatus,
        }
    })

    const totals = {
        all: rows.length,
        pendingApproval: rows.filter(r => r.onboardingStatus === 'PENDING_APPROVAL').length,
        waitingSignature: rows.filter(r => r.onboardingStatus === 'APPROVED_WAITING_SIGNATURE').length,
        active: rows.filter(r => r.onboardingStatus === 'ACTIVE').length,
    }

    return NextResponse.json({ items: rows, totals })
}