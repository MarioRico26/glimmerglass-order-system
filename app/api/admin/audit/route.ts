import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Si tienes un modelo tipo AuditLog, cámbialo aquí.
    // Mientras tanto, esto evita que el build explote por Prisma config mala.
    // Ejemplo real:
    // const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    // return NextResponse.json({ logs })

    return NextResponse.json({ logs: [] })
  } catch (err: any) {
    console.error('GET /api/admin/audit error:', err)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}