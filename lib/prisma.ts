import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function makePrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (Vercel → Settings → Environment Variables)')
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

export const prisma = global.__prisma ?? makePrismaClient()

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

export default prisma