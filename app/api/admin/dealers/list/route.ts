// app/api/admin/dealers/list/route.ts
import { AdminModule } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdminAccess } from '@/lib/adminAccess'

export async function GET() {
    try {
        await requireAdminAccess(AdminModule.DEALERS)
        const items = await prisma.dealer.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { name: 'asc' },
        })
        return NextResponse.json({ items }, { status: 200 })
    } catch (e: unknown) {
        const status =
            typeof e === 'object' && e !== null && 'status' in e && typeof (e as { status?: unknown }).status === 'number'
                ? (e as { status: number }).status
                : 500
        const message =
            typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message?: unknown }).message === 'string'
                ? (e as { message: string }).message
                : status === 403
                    ? 'Unauthorized'
                    : 'Internal Server Error'
        return NextResponse.json({ message }, { status })
    }
}
