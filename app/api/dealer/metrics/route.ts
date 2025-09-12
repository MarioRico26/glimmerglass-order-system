import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function GET() {
  const session = (await getServerSession(authOptions)) as Session | null

  if (!session || session.user?.role !== 'DEALER') {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // 1) Resolver dealerId de la sesión o via User
  let dealerId: string | null =
    (session.user as any)?.dealerId ?? null

  if (!dealerId && session.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { dealerId: true },
    })
    dealerId = user?.dealerId ?? null
  }

  if (!dealerId) {
    return NextResponse.json({ message: 'Dealer not found for this session' }, { status: 404 })
  }

  // 2) Traer dealer por si quieres nombre en cabecera
  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
    select: { id: true, name: true },
  })
  if (!dealer) {
    return NextResponse.json({ message: 'Dealer not found' }, { status: 404 })
  }

  // 3) Traer órdenes del dealer
  const orders = await prisma.order.findMany({
    where: { dealerId },
    select: { id: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  // 4) Totales por estatus
  const totals: Record<string, number> = {
    total: orders.length,
    PENDING_PAYMENT_APPROVAL: 0,
    APPROVED: 0,
    IN_PRODUCTION: 0,
    COMPLETED: 0,
    CANCELED: 0,
  }
  orders.forEach(o => {
    totals[o.status] = (totals[o.status] || 0) + 1
  })

  // 5) Serie mensual últimos 6 meses
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const monthlyMap = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(key, 0)
  }

  orders
    .filter(o => o.createdAt >= sixMonthsAgo)
    .forEach(o => {
      const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1)
      }
    })

  const monthly = Array.from(monthlyMap.entries()).map(([key, count]) => {
    const [y, m] = key.split('-')
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', {
      month: 'short',
    })
    return { key, label, count }
  })

  // 6) Órdenes recientes con nombres reales
  const recent = await prisma.order.findMany({
    where: { dealerId },
    include: {
      poolModel: { select: { name: true } },
      color: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  })

  return NextResponse.json({
    dealer: { id: dealer.id, name: dealer.name },
    totals,
    monthly,
    recent: recent.map(r => ({
      id: r.id,
      model: r.poolModel?.name ?? '-',
      color: r.color?.name ?? '-',
      status: r.status,
      createdAt: r.createdAt,
    })),
  })
}