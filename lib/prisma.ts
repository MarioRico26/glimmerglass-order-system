// lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

// Neon serverless en Node necesita WebSocket constructor
neonConfig.webSocketConstructor = ws as any

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaNeon(pool)

export const prisma =
  global.__prisma ??
  new PrismaClient({
    adapter,
  })

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma

export default prisma