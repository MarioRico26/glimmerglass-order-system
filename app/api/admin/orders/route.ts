// app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/requireRole'

const SAFE_SORT = new Set(['createdAt', 'status'])
const SAFE_DIR = new Set(['asc', 'desc'])

export async function GET(req: NextRequest) {
    try {
        await requireRole(['ADMIN', 'SUPERADMIN'])

        const { searchParams } = new URL(req.url)

        // Filtros
        const q = (searchParams.get('q') || '').trim()
        const status = searchParams.get('status') || '' // exact
        const dealer = searchParams.get('dealer') || ''
        const factory = searchParams.get('factory') || ''

        // Orden
        const sort = SAFE_SORT.has(searchParams.get('sort') || '') ? (searchParams.get('sort') as 'createdAt' | 'status') : 'createdAt'
        const dir = SAFE_DIR.has(searchParams.get('dir') || '') ? (searchParams.get('dir') as 'asc' | 'desc') : 'desc'

        // Paginación
        const page = Math.max(1, Number(searchParams.get('page') || 1))
        const pageSize = Math.min(100, Math.max(5, Number(searchParams.get('pageSize') || 20)))
        const skip = (page - 1) * pageSize
        const take = pageSize

        // WHERE dinámico
        const where: any = {}

        if (status) where.status = status

        if (dealer) {
            where.dealer = { name: { equals: dealer } }
        }
        if (factory) {
            where.factoryLocation = { name: { equals: factory } }
        }

        if (q) {
            // Búsqueda simple OR
            where.OR = [
                { deliveryAddress: { contains: q, mode: 'insensitive' } },
                { poolModel: { name: { contains: q, mode: 'insensitive' } } },
                { color: { name: { contains: q, mode: 'insensitive' } } },
                { dealer: { name: { contains: q, mode: 'insensitive' } } },
                { factoryLocation: { name: { contains: q, mode: 'insensitive' } } },
                { status: { contains: q, mode: 'insensitive' } },
            ]
        }

        const [total, items] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.findMany({
                where,
                orderBy: { [sort]: dir },
                skip,
                take,
                select: {
                    id: true,
                    deliveryAddress: true,
                    status: true,
                    paymentProofUrl: true,
                    createdAt: true,
                    poolModel: { select: { name: true } },
                    color: { select: { name: true } },
                    dealer: { select: { name: true } },
                    factoryLocation: { select: { name: true } },
                },
            }),
        ])

        // Normalizamos "factory" en la respuesta
        const mapped = items.map(o => ({
            id: o.id,
            deliveryAddress: o.deliveryAddress ?? '',
            status: o.status,
            paymentProofUrl: o.paymentProofUrl ?? null,
            poolModel: o.poolModel,
            color: o.color,
            dealer: o.dealer,
            factory: o.factoryLocation, // alias
            createdAt: o.createdAt,
        }))

        return NextResponse.json({
            items: mapped,
            page,
            pageSize,
            total,
        })
    } catch (e) {
        console.error('GET /api/admin/orders error:', e)
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}