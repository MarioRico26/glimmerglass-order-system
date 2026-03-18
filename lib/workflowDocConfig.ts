import type { OrderDocType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DOC_TYPE_LABELS, WORKFLOW_DOC_OPTIONS, type OrderDocTypeKey } from '@/lib/orderFlow'

type DbClient = Pick<typeof prisma, 'workflowDocConfig'>

export type WorkflowDocConfigItem = {
  docType: OrderDocTypeKey
  label: string
  sortOrder: number
  source: 'default' | 'custom'
}

const validDocSet = new Set<OrderDocTypeKey>(WORKFLOW_DOC_OPTIONS)

export const DEFAULT_WORKFLOW_DOC_LABELS: Record<OrderDocTypeKey, string> = WORKFLOW_DOC_OPTIONS.reduce(
  (acc, docType) => {
    acc[docType] = DOC_TYPE_LABELS[docType] || docType.replaceAll('_', ' ')
    return acc
  },
  {} as Record<OrderDocTypeKey, string>
)

export const DEFAULT_WORKFLOW_DOC_ORDER: Record<OrderDocTypeKey, number> = WORKFLOW_DOC_OPTIONS.reduce(
  (acc, docType, index) => {
    acc[docType] = index
    return acc
  },
  {} as Record<OrderDocTypeKey, number>
)

function isKnownDocType(value: string): value is OrderDocTypeKey {
  return validDocSet.has(value as OrderDocTypeKey)
}

function sanitizeLabel(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, 120)
}

function sanitizeSortOrder(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.floor(parsed))
}

function isMissingTableError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    ((error as { code?: string }).code === 'P2021' ||
      (error as { code?: string }).code === 'P2022')
  )
}

async function readCustomLabels(db: DbClient = prisma) {
  try {
    const rows = await db.workflowDocConfig.findMany({
      select: { docType: true, label: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { docType: 'asc' }],
    })

    return rows
      .filter((row) => isKnownDocType(row.docType))
      .map((row) => ({
        docType: row.docType as OrderDocTypeKey,
        label: sanitizeLabel(row.label),
        sortOrder: sanitizeSortOrder(row.sortOrder, DEFAULT_WORKFLOW_DOC_ORDER[row.docType as OrderDocTypeKey]),
      }))
      .filter((row) => row.label.length > 0)
  } catch (error) {
    if (isMissingTableError(error)) {
      return []
    }
    throw error
  }
}

export async function listWorkflowDocConfigs(db: DbClient = prisma): Promise<WorkflowDocConfigItem[]> {
  const customRows = await readCustomLabels(db)
  const customMap = new Map(customRows.map((row) => [row.docType, row] as const))

  return WORKFLOW_DOC_OPTIONS.map((docType) => ({
    docType,
    label: customMap.get(docType)?.label || DEFAULT_WORKFLOW_DOC_LABELS[docType],
    sortOrder: customMap.get(docType)?.sortOrder ?? DEFAULT_WORKFLOW_DOC_ORDER[docType],
    source: customMap.has(docType) ? 'custom' : 'default',
  })).sort((a, b) => a.sortOrder - b.sortOrder || a.docType.localeCompare(b.docType))
}

export async function getWorkflowDocLabelMap(db: DbClient = prisma) {
  const items = await listWorkflowDocConfigs(db)
  return items.reduce(
    (acc, item) => {
      acc[item.docType] = item.label
      return acc
    },
    {} as Record<OrderDocTypeKey, string>
  )
}

export async function upsertWorkflowDocLabels(
  entries: Array<{ docType?: unknown; label?: unknown; sortOrder?: unknown }>,
  db: DbClient = prisma
): Promise<WorkflowDocConfigItem[]> {
  const normalized = entries
    .map((entry, index) => {
      const docType = typeof entry?.docType === 'string' ? entry.docType : ''
      const label = sanitizeLabel(entry?.label)
      const sortOrder = sanitizeSortOrder(entry?.sortOrder, index)
      return { docType, label, sortOrder }
    })
    .filter((entry) => isKnownDocType(entry.docType) && entry.label.length > 0) as Array<{
    docType: OrderDocTypeKey
    label: string
    sortOrder: number
  }>

  if (normalized.length === 0) {
    throw new Error('No valid document labels provided')
  }

  try {
    await prisma.$transaction(
      normalized.map((entry) =>
        db.workflowDocConfig.upsert({
          where: { docType: entry.docType as OrderDocType },
          create: {
            docType: entry.docType as OrderDocType,
            label: entry.label,
            sortOrder: entry.sortOrder,
          },
          update: {
            label: entry.label,
            sortOrder: entry.sortOrder,
          },
        })
      )
    )
  } catch (error) {
    if (isMissingTableError(error)) {
      throw new Error('Workflow document config table is not available yet. Run the Prisma migration first.')
    }
    throw error
  }

  return listWorkflowDocConfigs(db)
}
