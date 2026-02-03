import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

const prisma =
  global.__prisma ??
  new PrismaClient({
    // NO metas engineType "client" aquí.
    // Prisma normal (library/binary) en Node funciona perfecto en Vercel.
  })

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

export default prisma