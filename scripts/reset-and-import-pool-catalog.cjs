#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

function parseArgs(argv) {
  const args = { csvPath: '', apply: false }
  for (const arg of argv.slice(2)) {
    if (arg === '--apply') args.apply = true
    else if (!args.csvPath) args.csvPath = arg
  }
  return args
}

function makePrisma() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is missing. Set it in .env or .env.local.')
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // ignore
    } else {
      field += ch
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function cleanText(raw) {
  return String(raw ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKey(raw) {
  return cleanText(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizePoolName(name) {
  let out = cleanText(name)
  out = out.replace(/JU\+A3:A73AN/gi, 'JUAN')
  out = out.replace(/\s{2,}/g, ' ')
  return out.trim()
}

function parseFeet(value, fieldName, rowNumber) {
  const raw = cleanText(value)
  if (!raw) {
    throw new Error(`Row ${rowNumber}: ${fieldName} is required`)
  }

  const nums = Array.from(raw.matchAll(/(\d+(?:\.\d+)?)/g)).map((m) => Number(m[1]))
  if (!nums.length) {
    throw new Error(`Row ${rowNumber}: invalid ${fieldName} "${raw}"`)
  }

  const feet = nums[0]
  const inches = nums[1] ?? 0
  return Number((feet + inches / 12).toFixed(4))
}

function parseInteger(value, fieldName, rowNumber) {
  const raw = cleanText(value)
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Row ${rowNumber}: invalid ${fieldName} "${raw}"`)
  }
  return Math.round(n)
}

function pickIndex(headerMap, candidates) {
  for (const c of candidates) {
    if (headerMap.has(c)) return headerMap.get(c)
  }
  return -1
}

function buildFactoryResolver(factories) {
  const keyToFactory = new Map()

  for (const f of factories) {
    const keys = new Set()
    keys.add(normalizeKey(f.name))
    keys.add(normalizeKey(`${f.name} ${f.city || ''}`))
    keys.add(normalizeKey(`${f.name} ${f.state || ''}`))
    keys.add(normalizeKey(`${f.name} ${f.city || ''} ${f.state || ''}`))
    keys.add(normalizeKey(`${f.city || ''} ${f.state || ''}`))

    for (const key of keys) {
      if (!key) continue
      if (!keyToFactory.has(key)) keyToFactory.set(key, f)
    }
  }

  return (rawFactory) => {
    const key = normalizeKey(rawFactory)
    if (!key) return null

    if (keyToFactory.has(key)) return keyToFactory.get(key)

    const candidates = factories.filter((f) => {
      const nameKey = normalizeKey(f.name)
      return key.includes(nameKey) || nameKey.includes(key)
    })

    if (candidates.length === 1) return candidates[0]
    return null
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (!args.csvPath) {
    throw new Error('Usage: node scripts/reset-and-import-pool-catalog.cjs "/absolute/path/file.csv" [--apply]')
  }

  const csvPath = path.resolve(args.csvPath)
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const prisma = makePrisma()

  try {
    const rawCsv = fs.readFileSync(csvPath, 'utf8')
    const rows = parseCsv(rawCsv)
    if (rows.length < 2) {
      throw new Error('CSV has no data rows.')
    }

    const headers = rows[0].map((h) => normalizeKey(h))
    const headerMap = new Map(headers.map((h, i) => [h, i]))

    const idxPoolName = pickIndex(headerMap, ['pool name'])
    const idxLength = pickIndex(headerMap, ['length'])
    const idxWidth = pickIndex(headerMap, ['width'])
    const idxDepth = pickIndex(headerMap, ['max depth', 'depth'])
    const idxFactory = pickIndex(headerMap, ['default factory', 'factory'])
    const idxImage = pickIndex(headerMap, ['image'])
    const idxSkimmer = pickIndex(headerMap, ['skimmer', 'skimmers'])
    const idxReturns = pickIndex(headerMap, ['returns', 'return'])

    const required = [
      ['pool name', idxPoolName],
      ['length', idxLength],
      ['width', idxWidth],
      ['max depth', idxDepth],
      ['default factory', idxFactory],
    ]
    const missing = required.filter(([, i]) => i < 0).map(([k]) => k)
    if (missing.length) {
      throw new Error(`CSV is missing required columns: ${missing.join(', ')}`)
    }

    const factories = await prisma.factoryLocation.findMany({
      select: { id: true, name: true, city: true, state: true, active: true },
      orderBy: { name: 'asc' },
    })

    if (!factories.length) {
      throw new Error('No factories found in DB. Cannot map Default Factory from CSV.')
    }

    const resolveFactory = buildFactoryResolver(factories)
    const data = []
    const unresolvedFactories = new Map()
    const duplicateNames = new Set()
    const seenNames = new Set()

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i]
      if (!row || row.every((cell) => cleanText(cell) === '')) continue

      const rowNum = i + 1
      const poolName = normalizePoolName(row[idxPoolName])
      if (!poolName) continue

      const factoryRaw = cleanText(row[idxFactory])
      const factory = resolveFactory(factoryRaw)
      if (!factory) {
        unresolvedFactories.set(factoryRaw || '(empty)', (unresolvedFactories.get(factoryRaw || '(empty)') || 0) + 1)
        continue
      }

      const lengthFt = parseFeet(row[idxLength], 'Length', rowNum)
      const widthFt = parseFeet(row[idxWidth], 'Width', rowNum)
      const depthFt = parseFeet(row[idxDepth], 'Max Depth', rowNum)

      const imageUrl = idxImage >= 0 ? cleanText(row[idxImage]) || null : null
      const maxSkimmers = idxSkimmer >= 0 ? parseInteger(row[idxSkimmer], 'Skimmer', rowNum) : null
      const maxReturns = idxReturns >= 0 ? parseInteger(row[idxReturns], 'Returns', rowNum) : null

      const dedupeKey = normalizeKey(poolName)
      if (seenNames.has(dedupeKey)) duplicateNames.add(poolName)
      seenNames.add(dedupeKey)

      data.push({
        name: poolName,
        lengthFt,
        widthFt,
        depthFt,
        defaultFactoryLocationId: factory.id,
        imageUrl,
        maxSkimmers,
        maxReturns,
        maxMainDrains: null,
      })
    }

    if (unresolvedFactories.size > 0) {
      const unresolved = Array.from(unresolvedFactories.entries())
        .map(([name, count]) => `${name} (${count})`)
        .join(', ')
      throw new Error(`Unresolved factory names in CSV: ${unresolved}`)
    }

    const before = {
      orders: await prisma.order.count(),
      orderHistory: await prisma.orderHistory.count(),
      orderMedia: await prisma.orderMedia.count(),
      poolStock: await prisma.poolStock.count(),
      poolStockTxn: await prisma.poolStockTxn.count(),
      poolModels: await prisma.poolModel.count(),
    }

    console.log('--- PREVIEW ---')
    console.log(`CSV rows parsed: ${data.length}`)
    console.log(`Factories in DB: ${factories.length}`)
    if (duplicateNames.size > 0) {
      console.log(`Duplicate pool names detected (kept as-is): ${Array.from(duplicateNames).join(', ')}`)
    }
    console.log('Current counts:', before)

    if (!args.apply) {
      console.log('Dry run only. Re-run with --apply to execute delete + import.')
      return
    }

    const txResult = await prisma.$transaction(async (tx) => {
      const inventoryTxnUnlinked = await tx.inventoryTxn.updateMany({
        where: { orderId: { not: null } },
        data: { orderId: null },
      })
      const notificationsUnlinked = await tx.notification.updateMany({
        where: { orderId: { not: null } },
        data: { orderId: null },
      })

      const deletedOrderHistory = await tx.orderHistory.deleteMany({})
      const deletedOrderMedia = await tx.orderMedia.deleteMany({})
      const deletedPoolStockTxn = await tx.poolStockTxn.deleteMany({})
      const deletedPoolStock = await tx.poolStock.deleteMany({})
      const deletedOrders = await tx.order.deleteMany({})
      const deletedPoolModels = await tx.poolModel.deleteMany({})

      const createdPoolModels = await tx.poolModel.createMany({ data })

      return {
        inventoryTxnUnlinked: inventoryTxnUnlinked.count,
        notificationsUnlinked: notificationsUnlinked.count,
        deletedOrderHistory: deletedOrderHistory.count,
        deletedOrderMedia: deletedOrderMedia.count,
        deletedPoolStockTxn: deletedPoolStockTxn.count,
        deletedPoolStock: deletedPoolStock.count,
        deletedOrders: deletedOrders.count,
        deletedPoolModels: deletedPoolModels.count,
        createdPoolModels: createdPoolModels.count,
      }
    })

    const after = {
      orders: await prisma.order.count(),
      orderHistory: await prisma.orderHistory.count(),
      orderMedia: await prisma.orderMedia.count(),
      poolStock: await prisma.poolStock.count(),
      poolStockTxn: await prisma.poolStockTxn.count(),
      poolModels: await prisma.poolModel.count(),
    }

    console.log('--- APPLY RESULT ---')
    console.log(txResult)
    console.log('Final counts:', after)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Import failed:', err.message || err)
  process.exit(1)
})

