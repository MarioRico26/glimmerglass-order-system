import 'dotenv/config'
import prisma from '../lib/prisma'

type Row = {
  orderId: string
  createdAt: Date
  dealerName: string | null
  poolModelName: string | null
  docType: string | null
  uploadedAt: Date
  visibleToDealer: boolean
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT
      o."id" AS "orderId",
      o."createdAt" AS "createdAt",
      d."name" AS "dealerName",
      pm."name" AS "poolModelName",
      om."docType"::text AS "docType",
      om."uploadedAt" AS "uploadedAt",
      om."visibleToDealer" AS "visibleToDealer"
    FROM "OrderMedia" om
    INNER JOIN "Order" o ON o."id" = om."orderId"
    LEFT JOIN "Dealer" d ON d."id" = o."dealerId"
    LEFT JOIN "PoolModel" pm ON pm."id" = o."poolModelId"
    ORDER BY o."createdAt" DESC, om."uploadedAt" DESC
  `)

  const grouped = new Map<string, {
    orderId: string
    createdAt: Date
    dealerName: string | null
    poolModelName: string | null
    mediaCount: number
    docs: Array<{ docType: string | null; uploadedAt: Date; visibleToDealer: boolean }>
  }>()

  for (const row of rows) {
    if (!grouped.has(row.orderId)) {
      grouped.set(row.orderId, {
        orderId: row.orderId,
        createdAt: row.createdAt,
        dealerName: row.dealerName,
        poolModelName: row.poolModelName,
        mediaCount: 0,
        docs: [],
      })
    }
    const item = grouped.get(row.orderId)!
    item.mediaCount += 1
    item.docs.push({
      docType: row.docType,
      uploadedAt: row.uploadedAt,
      visibleToDealer: row.visibleToDealer,
    })
  }

  console.log(JSON.stringify(Array.from(grouped.values()), null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
