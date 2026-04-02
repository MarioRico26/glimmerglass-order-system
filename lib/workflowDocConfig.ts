import type { OrderDocType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DOC_TYPE_LABELS, WORKFLOW_DOC_OPTIONS, type OrderDocTypeKey } from '@/lib/orderFlow'

type DbClient = Pick<typeof prisma, 'workflowDocumentDefinition' | '$transaction'>

export type WorkflowDocDefinitionItem = {
  id: string
  key: string
  label: string
  sortOrder: number
  source: 'legacy' | 'custom'
  legacyDocType: OrderDocTypeKey | null
  active: boolean
  visibleToDealerDefault: boolean
}

const LEGACY_DOC_DEFINITIONS = WORKFLOW_DOC_OPTIONS.map((docType, index) => ({
  id: `docdef-${docType.toLowerCase().replaceAll('_', '-')}`,
  key: docType,
  label: DOC_TYPE_LABELS[docType] || docType.replaceAll('_', ' '),
  sortOrder: index,
  legacyDocType: docType,
  visibleToDealerDefault: true,
}))

function sanitizeLabel(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, 120)
}

function normalizeLabelKey(value: string) {
  return sanitizeLabel(value).toLowerCase()
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
    ((error as { code?: string }).code === 'P2021' || (error as { code?: string }).code === 'P2022')
  )
}

function slugifyKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

async function uniqueCustomDocumentKey(baseLabel: string, db: DbClient) {
  const base = slugifyKey(baseLabel) || 'custom_document'
  let attempt = 0
  while (attempt < 100) {
    const key = attempt === 0 ? base : `${base}_${attempt + 1}`
    const existing = await db.workflowDocumentDefinition.findUnique({
      where: { key },
      select: { id: true },
    })
    if (!existing) return key
    attempt += 1
  }
  throw new Error('Could not generate a unique document key')
}

function fromDb(item: {
  id: string
  key: string
  label: string
  sortOrder: number
  legacyDocType: OrderDocType | null
  active: boolean
  visibleToDealerDefault: boolean
}): WorkflowDocDefinitionItem {
  return {
    id: item.id,
    key: item.key,
    label: item.label,
    sortOrder: item.sortOrder,
    source: item.legacyDocType ? 'legacy' : 'custom',
    legacyDocType: (item.legacyDocType as OrderDocTypeKey | null) ?? null,
    active: item.active,
    visibleToDealerDefault: item.visibleToDealerDefault,
  }
}

export async function listWorkflowDocConfigs(db: DbClient = prisma): Promise<WorkflowDocDefinitionItem[]> {
  try {
    const rows = await db.workflowDocumentDefinition.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: {
        id: true,
        key: true,
        label: true,
        sortOrder: true,
        legacyDocType: true,
        active: true,
        visibleToDealerDefault: true,
      },
    })
    return rows.map(fromDb)
  } catch (error) {
    if (isMissingTableError(error)) {
      return LEGACY_DOC_DEFINITIONS.map((item) => ({ ...item, source: 'legacy' as const, active: true }))
    }
    throw error
  }
}

export async function getWorkflowDocLabelMap(db: DbClient = prisma) {
  const items = await listWorkflowDocConfigs(db)
  return items.reduce(
    (acc, item) => {
      acc[item.key] = item.label
      if (item.legacyDocType) acc[item.legacyDocType] = item.label
      return acc
    },
    {} as Record<string, string>
  )
}

export async function getWorkflowDocDefinitionMap(db: DbClient = prisma) {
  const items = await listWorkflowDocConfigs(db)
  return items.reduce(
    (acc, item) => {
      acc[item.key] = item
      if (item.legacyDocType) acc[item.legacyDocType] = item
      return acc
    },
    {} as Record<string, WorkflowDocDefinitionItem>
  )
}

export async function createWorkflowDocumentDefinition(
  input: { label?: unknown; visibleToDealerDefault?: unknown },
  db: DbClient = prisma
) {
  const label = sanitizeLabel(input.label)
  if (!label) {
    throw new Error('Document label is required')
  }

  const existingItems = await listWorkflowDocConfigs(db)
  if (existingItems.some((item) => normalizeLabelKey(item.label) === normalizeLabelKey(label))) {
    throw new Error('A workflow document with that label already exists')
  }
  const key = await uniqueCustomDocumentKey(label, db)
  const sortOrder = existingItems.length

  const created = await db.workflowDocumentDefinition.create({
    data: {
      key,
      label,
      sortOrder,
      visibleToDealerDefault:
        typeof input.visibleToDealerDefault === 'boolean' ? input.visibleToDealerDefault : true,
    },
    select: {
      id: true,
      key: true,
      label: true,
      sortOrder: true,
      legacyDocType: true,
      active: true,
      visibleToDealerDefault: true,
    },
  })

  return fromDb(created)
}

export async function upsertWorkflowDocLabels(
  entries: Array<{ key?: unknown; docType?: unknown; label?: unknown; sortOrder?: unknown; active?: unknown; visibleToDealerDefault?: unknown }>,
  db: DbClient = prisma
): Promise<WorkflowDocDefinitionItem[]> {
  const current = await listWorkflowDocConfigs(db)
  const currentMap = new Map(current.map((item) => [item.key, item] as const))

  const normalized = entries
    .map((entry, index) => {
      const keyRaw = typeof entry?.key === 'string' ? entry.key : typeof entry?.docType === 'string' ? entry.docType : ''
      const key = keyRaw.trim()
      const label = sanitizeLabel(entry?.label)
      const sortOrder = sanitizeSortOrder(entry?.sortOrder, index)
      const active = typeof entry?.active === 'boolean' ? entry.active : true
      const visibleToDealerDefault =
        typeof entry?.visibleToDealerDefault === 'boolean'
          ? entry.visibleToDealerDefault
          : currentMap.get(key)?.visibleToDealerDefault ?? true
      return { key, label, sortOrder, active, visibleToDealerDefault }
    })
    .filter((entry) => entry.key && entry.label)

  if (normalized.length === 0) {
    throw new Error('No valid document labels provided')
  }

  const duplicateLabels = normalized.reduce((acc, entry) => {
    const labelKey = normalizeLabelKey(entry.label)
    acc[labelKey] = (acc[labelKey] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  if (Object.values(duplicateLabels).some((count) => count > 1)) {
    throw new Error('Document labels must stay unique')
  }

  await db.$transaction(
    normalized.map((entry) =>
      db.workflowDocumentDefinition.update({
        where: { key: entry.key },
        data: {
          label: entry.label,
          sortOrder: entry.sortOrder,
          active: entry.active,
          visibleToDealerDefault: entry.visibleToDealerDefault,
        },
      })
    )
  )

  return listWorkflowDocConfigs(db)
}
