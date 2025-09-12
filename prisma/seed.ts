// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

/** ========= helpers ========= */

type PoolSeed = {
  name: string
  lengthFt: number
  widthFt: number
  depthFt: number
  shape?: string | null
}

async function ensurePoolModel(data: PoolSeed) {
  // usamos name como clave "lógica"
  const found = await prisma.poolModel.findFirst({ where: { name: data.name } })
  if (found) return found
  return prisma.poolModel.create({ data })
}

async function ensureColor(name: string) {
  const found = await prisma.color.findFirst({ where: { name } })
  if (found) return found
  return prisma.color.create({ data: { name } })
}

async function ensureFactory(name: string) {
  const found = await prisma.factoryLocation.findFirst({ where: { name } })
  if (found) return found
  return prisma.factoryLocation.create({ data: { name } })
}

async function ensureAdminUser() {
  const email = 'admin@glimmerglass.test'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return existing

  const { hash } = await import('bcryptjs')
  const passwordHash = await hash('admin123', 10)

  return prisma.user.create({
    data: {
      email,
      password: passwordHash,
      role: 'ADMIN',
      approved: true,
    },
  })
}

/** ========= main ========= */

async function main() {
  // Pool models con CAMPOS REQUERIDOS (ajusta medidas según tu catálogo real)
  const [artic40, artic35] = await Promise.all([
    ensurePoolModel({
      name: 'Artic 40',
      lengthFt: 40,
      widthFt: 13,     // <- ajusta si tu modelo real difiere
      depthFt: 6,      // <- ajusta si tu modelo real difiere
      shape: 'Rectangular',
    }),
    ensurePoolModel({
      name: 'Artic 35',
      lengthFt: 35,
      widthFt: 12,     // <- ajusta si tu modelo real difiere
      depthFt: 6,      // <- ajusta si tu modelo real difiere
      shape: 'Rectangular',
    }),
  ])

  // Colores
  const [blue, white, grey] = await Promise.all([
    ensureColor('Ocean Blue'),
    ensureColor('Arctic White'),
    ensureColor('Stone Grey'),
  ])

  // Fábricas
  const [nyFactory, flFactory] = await Promise.all([
    ensureFactory('Upstate NY'),
    ensureFactory('South Florida'),
  ])

  // Admin
  await ensureAdminUser()

  // Dealer demo + órdenes demo
  const dealerEmail = 'dealer.demo@glimmerglass.test'
  let dealerUser = await prisma.user.findUnique({ where: { email: dealerEmail } })

  if (!dealerUser) {
    const { hash } = await import('bcryptjs')
    const pass = await hash('dealer123', 10)

    const dealer = await prisma.dealer.create({
      data: {
        name: 'Sunrise Pools LLC',
        email: dealerEmail,
        phone: '555-555-0101',
        city: 'Orlando',
        state: 'Florida',
      },
    })

    dealerUser = await prisma.user.create({
      data: {
        email: dealerEmail,
        password: pass,
        role: 'DEALER',
        approved: true,
        dealerId: dealer.id,
      },
    })

    await prisma.order.createMany({
      data: [
        {
          dealerId: dealer.id,
          poolModelId: artic40.id,
          colorId: blue.id,
          factoryLocationId: nyFactory.id,
          deliveryAddress: '123 Lake View Rd, Syracuse, NY',
          status: 'PENDING_PAYMENT_APPROVAL',
        },
        {
          dealerId: dealer.id,
          poolModelId: artic35.id,
          colorId: white.id,
          factoryLocationId: flFactory.id,
          deliveryAddress: '987 Palm Dr, Miami, FL',
          status: 'APPROVED',
        },
      ],
    })
  }
}

main()
  .then(async () => {
    console.log('✅ Seed OK')
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })