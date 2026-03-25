// app/api/admin/dealers/approve/route.ts
import { AdminModule } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAccess } from '@/lib/adminAccess'

async function handle(req: NextRequest) {
    try {
        await requireAdminAccess(AdminModule.DEALERS)
        const body = await req.json().catch(() => null) as { dealerId?: string; approved?: boolean } | null
        const dealerId = body?.dealerId?.trim()
        const approved = typeof body?.approved === 'boolean' ? body!.approved : undefined

        if (!dealerId || typeof approved !== 'boolean') {
            return NextResponse.json({ message: 'Missing or invalid data' }, { status: 400 })
        }

        // Verifica que exista el dealer
        const dealer = await prisma.dealer.findUnique({
            where: { id: dealerId },
            select: { id: true, name: true, email: true, phone: true, city: true, state: true, agreementUrl: true },
        })
        if (!dealer) {
            return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
        }

        // Actualiza todos los usuarios vinculados a este dealer
        const updateRes = await prisma.user.updateMany({
            where: { dealerId },
            data: { approved },
        })

        if (updateRes.count === 0) {
            // Dealer existe, pero sin usuarios vinculados
            return NextResponse.json({
                message: 'Dealer exists but no linked users were found to update',
                dealer: {
                    id: dealer.id,
                    name: dealer.name,
                    email: dealer.email,
                    phone: dealer.phone ?? '',
                    city: dealer.city ?? '',
                    state: dealer.state ?? '',
                    approved: false,
                    agreementUrl: dealer.agreementUrl ?? null,
                },
            }, { status: 200 })
        }

        return NextResponse.json({
            message: `Dealer ${approved ? 'approved' : 'revoked'} successfully`,
            dealer: {
                id: dealer.id,
                name: dealer.name,
                email: dealer.email,
                phone: dealer.phone ?? '',
                city: dealer.city ?? '',
                state: dealer.state ?? '',
                approved, // valor aplicado
                agreementUrl: dealer.agreementUrl ?? null,
            },
        }, { status: 200 })
    } catch (error: any) {
        console.error('Approval error:', error)
        return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: error?.status || 500 })
    }
}

export async function PATCH(req: NextRequest) {
    return handle(req)
}

export async function POST(req: NextRequest) {
    return handle(req)
}
