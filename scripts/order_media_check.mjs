import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const rows = await prisma.order.findMany({
    select: {
      id: true,
      createdAt: true,
      dealer: { select: { name: true } },
      poolModel: { select: { name: true } },
      media: {
        select: {
          id: true,
          docType: true,
          uploadedAt: true,
          visibleToDealer: true,
          uploadedByDisplayName: true,
          uploadedByEmail: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const withDocs = rows
    .filter((row) => row.media.length > 0)
    .map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      dealer: row.dealer?.name ?? null,
      poolModel: row.poolModel?.name ?? null,
      mediaCount: row.media.length,
      docs: row.media.map((m) => ({
        docType: m.docType,
        uploadedAt: m.uploadedAt,
        visibleToDealer: m.visibleToDealer,
        uploadedByDisplayName: m.uploadedByDisplayName,
        uploadedByEmail: m.uploadedByEmail,
      })),
    }))

  console.log(JSON.stringify(withDocs, null, 2))
} finally {
  await prisma.$disconnect()
}
