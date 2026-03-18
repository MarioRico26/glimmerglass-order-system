import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  REQUIRED_FIELDS_FOR,
  REQUIRED_FOR,
  REQUIREMENT_FIELD_KEYS,
  WORKFLOW_DOC_OPTIONS,
  type FlowStatus,
  type OrderDocTypeKey,
  type RequirementFieldKey,
} from '@/lib/orderFlow'

type RequirementSource = 'default' | 'custom'

export type StatusRequirementConfig = {
  status: FlowStatus
  requiredDocs: OrderDocTypeKey[]
  requiredFields: RequirementFieldKey[]
  source: RequirementSource
}

type DbClient = Pick<typeof prisma, 'orderStatusRequirementTemplate'>

export const TEMPLATE_STATUSES: FlowStatus[] = [
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
]

const templateStatusSet = new Set<FlowStatus>(TEMPLATE_STATUSES)
const validDocSet = new Set<OrderDocTypeKey>(WORKFLOW_DOC_OPTIONS)
const validFieldSet = new Set<RequirementFieldKey>(REQUIREMENT_FIELD_KEYS)

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

export function isTemplateStatus(value: string): value is FlowStatus {
  return templateStatusSet.has(value as FlowStatus)
}

export function sanitizeRequirementDocs(value: unknown): OrderDocTypeKey[] {
  if (!Array.isArray(value)) return []
  const docs = value
    .filter((v): v is string => typeof v === 'string')
    .filter((v): v is OrderDocTypeKey => validDocSet.has(v as OrderDocTypeKey))
  return uniq(docs)
}

export function sanitizeRequirementFields(value: unknown): RequirementFieldKey[] {
  if (!Array.isArray(value)) return []
  const fields = value
    .filter((v): v is string => typeof v === 'string')
    .filter((v): v is RequirementFieldKey => validFieldSet.has(v as RequirementFieldKey))
  return uniq(fields)
}

export function defaultRequirementsForStatus(status: FlowStatus): Omit<StatusRequirementConfig, 'source'> {
  const requiredDocs = sanitizeRequirementDocs(REQUIRED_FOR[status] ?? [])
  const requiredFields = sanitizeRequirementFields(REQUIRED_FIELDS_FOR[status] ?? [])
  return { status, requiredDocs, requiredFields }
}

function asOrderStatus(status: FlowStatus): OrderStatus {
  return status as unknown as OrderStatus
}

export async function getStatusRequirements(
  status: FlowStatus,
  db: DbClient = prisma
): Promise<StatusRequirementConfig> {
  const custom = await db.orderStatusRequirementTemplate.findUnique({
    where: { status: asOrderStatus(status) },
    select: { requiredDocs: true, requiredFields: true },
  })

  if (!custom) {
    const defaults = defaultRequirementsForStatus(status)
    return { ...defaults, source: 'default' }
  }

  return {
    status,
    requiredDocs: sanitizeRequirementDocs(custom.requiredDocs),
    requiredFields: sanitizeRequirementFields(custom.requiredFields),
    source: 'custom',
  }
}

export async function listTemplateRequirements(
  db: DbClient = prisma
): Promise<StatusRequirementConfig[]> {
  const items = await Promise.all(TEMPLATE_STATUSES.map((s) => getStatusRequirements(s, db)))
  return items
}

export async function upsertStatusRequirements(
  status: FlowStatus,
  requiredDocs: OrderDocTypeKey[],
  requiredFields: RequirementFieldKey[],
  db: DbClient = prisma
): Promise<StatusRequirementConfig> {
  const docs = sanitizeRequirementDocs(requiredDocs)
  const fields = sanitizeRequirementFields(requiredFields)

  await db.orderStatusRequirementTemplate.upsert({
    where: { status: asOrderStatus(status) },
    create: {
      status: asOrderStatus(status),
      requiredDocs: docs,
      requiredFields: fields,
    },
    update: {
      requiredDocs: docs,
      requiredFields: fields,
    },
  })

  return {
    status,
    requiredDocs: docs,
    requiredFields: fields,
    source: 'custom',
  }
}

export async function resetStatusRequirements(status: FlowStatus, db: DbClient = prisma) {
  await db.orderStatusRequirementTemplate.deleteMany({
    where: { status: asOrderStatus(status) },
  })
  const defaults = defaultRequirementsForStatus(status)
  return { ...defaults, source: 'default' as const }
}
