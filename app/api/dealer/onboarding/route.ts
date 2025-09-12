// app/api/dealer/onboarding/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions' // o tu ruta actual
import { prisma } from '@/lib/prisma'

export async function GET() {
    const session = await getServerSession(authOptions)
    const u = session?.user as any
    if (!u || u.role !== 'DEALER' || !u.dealerId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // datos del dealer + conteo de órdenes
    const [dealer, ordersCount] = await Promise.all([
        prisma.dealer.findUnique({
            where: { id: u.dealerId },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                city: true,
                state: true,
                taxDocUrl: true,
                agreementSignedAt: true,
                onboarding: true,
                onboardingCompletedAt: true,
            }
        }),
        prisma.order.count({ where: { dealerId: u.dealerId } })
    ])

    if (!dealer) {
        return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
    }

    // reglas de “completado”
    const hasProfile =
        Boolean(dealer.name && dealer.phone && dealer.address && dealer.city && dealer.state)
    const hasTaxDoc = Boolean(dealer.taxDocUrl)
    const hasAgreement = Boolean(dealer.agreementSignedAt)
    const hasFirstOrder = ordersCount > 0

    const steps = [
        { key: 'profile',    label: 'Complete profile',           done: hasProfile },
        { key: 'tax',        label: 'Upload W-9 / Tax document',  done: hasTaxDoc },
        { key: 'agreement',  label: 'Sign dealer agreement',      done: hasAgreement },
        { key: 'firstOrder', label: 'Place your first order',     done: hasFirstOrder },
    ]

    const doneCount = steps.filter(s => s.done).length
    const progress = Math.round((doneCount / steps.length) * 100)

    return NextResponse.json({
        steps, progress,
        dealer: {
            id: dealer.id,
            name: dealer.name,
            taxDocUrl: dealer.taxDocUrl,
            agreementSignedAt: dealer.agreementSignedAt,
            onboardingCompletedAt: dealer.onboardingCompletedAt,
        }
    })
}

export async function PATCH(req: Request) {
    const session = await getServerSession(authOptions)
    const u = session?.user as any
    if (!u || u.role !== 'DEALER' || !u.dealerId) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    // Permite guardar “onboarding” (notas/flags adicionales del front si quisieras)
    const body = await req.json().catch(() => ({}))
    const onboarding = body?.onboarding ?? {}

    const updated = await prisma.dealer.update({
        where: { id: u.dealerId },
        data: { onboarding }
    })

    return NextResponse.json({ ok: true, onboarding: updated.onboarding })
}