import 'dotenv/config'
import prisma from '../lib/prisma'

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<{ orderCount: bigint }>>(`
    SELECT COUNT(DISTINCT om."orderId")::bigint AS "orderCount"
    FROM "OrderMedia" om
  `)
  console.log(rows[0]?.orderCount?.toString() || '0')
}

main().finally(async () => {
  await prisma.$disconnect()
})
