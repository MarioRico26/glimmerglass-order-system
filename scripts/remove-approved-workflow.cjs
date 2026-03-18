#!/usr/bin/env node
require('dotenv/config')

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const args = new Set(process.argv.slice(2))
const execute = args.has('--execute')
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
})

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)))
}

async function getSnapshot() {
  const [ordersByStatus, templates] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
    prisma.orderStatusRequirementTemplate.findMany({
      where: { status: { in: ['APPROVED', 'IN_PRODUCTION'] } },
      select: { status: true, requiredDocs: true, requiredFields: true },
      orderBy: { status: 'asc' },
    }),
  ])

  const orderCounts = Object.fromEntries(
    ordersByStatus.map((row) => [row.status, row._count._all])
  )

  return { orderCounts, templates }
}

async function main() {
  const before = await getSnapshot()

  console.log('Workflow snapshot before migration:')
  console.log(JSON.stringify(before, null, 2))

  if (!execute) {
    console.log('')
    console.log('Dry run only. Re-run with --execute to apply changes.')
    return
  }

  const result = await prisma.$transaction(async (tx) => {
    const approvedTemplate = await tx.orderStatusRequirementTemplate.findUnique({
      where: { status: 'APPROVED' },
      select: { requiredDocs: true, requiredFields: true },
    })

    const inProductionTemplate = await tx.orderStatusRequirementTemplate.findUnique({
      where: { status: 'IN_PRODUCTION' },
      select: { requiredDocs: true, requiredFields: true },
    })

    if (approvedTemplate) {
      await tx.orderStatusRequirementTemplate.upsert({
        where: { status: 'IN_PRODUCTION' },
        create: {
          status: 'IN_PRODUCTION',
          requiredDocs: uniq([
            ...(approvedTemplate.requiredDocs || []),
            ...(inProductionTemplate?.requiredDocs || []),
          ]),
          requiredFields: uniq([
            ...(approvedTemplate.requiredFields || []),
            ...(inProductionTemplate?.requiredFields || []),
          ]),
        },
        update: {
          requiredDocs: uniq([
            ...(approvedTemplate.requiredDocs || []),
            ...(inProductionTemplate?.requiredDocs || []),
          ]),
          requiredFields: uniq([
            ...(approvedTemplate.requiredFields || []),
            ...(inProductionTemplate?.requiredFields || []),
          ]),
        },
      })

      await tx.orderStatusRequirementTemplate.deleteMany({
        where: { status: 'APPROVED' },
      })
    }

    const updatedOrders = await tx.order.updateMany({
      where: { status: 'APPROVED' },
      data: { status: 'IN_PRODUCTION' },
    })

    return {
      updatedOrders: updatedOrders.count,
      migratedTemplate: Boolean(approvedTemplate),
    }
  })

  const after = await getSnapshot()

  console.log('')
  console.log('Workflow migration applied:')
  console.log(JSON.stringify(result, null, 2))
  console.log('')
  console.log('Workflow snapshot after migration:')
  console.log(JSON.stringify(after, null, 2))
  console.log('')
  console.log('Note: OrderHistory rows are intentionally left unchanged for audit preservation.')
}

main()
  .catch((error) => {
    console.error('remove-approved-workflow failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
