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
  workflowProfileId?: string | null
}

type DbClient = Pick<
  typeof prisma,
  | 'orderStatusRequirementTemplate'
  | 'workflowProfileRequirementTemplate'
  | 'workflowProfile'
  | '$transaction'
>

export const TEMPLATE_STATUSES: FlowStatus[] = [
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
  'SERVICE_WARRANTY',
]

const templateStatusSet = new Set<FlowStatus>(TEMPLATE_STATUSES)
const validDocSet = new Set<OrderDocTypeKey>(WORKFLOW_DOC_OPTIONS)
const validFieldSet = new Set<RequirementFieldKey>(REQUIREMENT_FIELD_KEYS)

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr))
}

function slugifyName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

async function uniqueWorkflowProfileNameAndSlug(
  baseName: string,
  db: DbClient,
  excludeId?: string
) {
  const trimmedBase = baseName.trim() || 'New Profile'
  const baseSlug = slugifyName(trimmedBase) || 'profile'

  let attempt = 0
  while (attempt < 100) {
    const suffix = attempt === 0 ? '' : ` ${attempt + 1}`
    const candidateName = `${trimmedBase}${suffix}`
    const candidateSlug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`

    const existing = await db.workflowProfile.findFirst({
      where: {
        OR: [{ name: candidateName }, { slug: candidateSlug }],
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!existing) {
      return { name: candidateName, slug: candidateSlug }
    }

    attempt += 1
  }

  throw new Error('Could not generate a unique workflow profile name')
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

export type WorkflowProfileSummary = {
  id: string
  slug: string
  name: string
  active: boolean
  dealerCount: number
  dealerNames: string[]
}

function asOrderStatus(status: FlowStatus): OrderStatus {
  return status as unknown as OrderStatus
}

export async function listWorkflowProfiles(db: DbClient = prisma): Promise<WorkflowProfileSummary[]> {
  const profiles = await db.workflowProfile.findMany({
    where: { active: true },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      active: true,
      dealers: {
        orderBy: [{ name: 'asc' }],
        select: { name: true },
      },
    },
  })
  return profiles.map((profile) => ({
    id: profile.id,
    slug: profile.slug,
    name: profile.name,
    active: profile.active,
    dealerCount: profile.dealers.length,
    dealerNames: profile.dealers.map((dealer) => dealer.name),
  }))
}

export async function getStatusRequirements(
  status: FlowStatus,
  workflowProfileId?: string | null,
  db: DbClient = prisma
): Promise<StatusRequirementConfig> {
  if (workflowProfileId) {
    const profileCustom = await db.workflowProfileRequirementTemplate.findUnique({
      where: {
        workflowProfileId_status: {
          workflowProfileId,
          status: asOrderStatus(status),
        },
      },
      select: { requiredDocs: true, requiredFields: true },
    })

    if (profileCustom) {
      return {
        status,
        requiredDocs: sanitizeRequirementDocs(profileCustom.requiredDocs),
        requiredFields: sanitizeRequirementFields(profileCustom.requiredFields),
        source: 'custom',
        workflowProfileId,
      }
    }
  }

  const custom = await db.orderStatusRequirementTemplate.findUnique({
    where: { status: asOrderStatus(status) },
    select: { requiredDocs: true, requiredFields: true },
  })

  if (!custom) {
    const defaults = defaultRequirementsForStatus(status)
    return { ...defaults, source: 'default', workflowProfileId: workflowProfileId ?? null }
  }

  return {
    status,
    requiredDocs: sanitizeRequirementDocs(custom.requiredDocs),
    requiredFields: sanitizeRequirementFields(custom.requiredFields),
    source: 'custom',
    workflowProfileId: workflowProfileId ?? null,
  }
}

export async function listTemplateRequirements(
  workflowProfileId?: string | null,
  db: DbClient = prisma
): Promise<StatusRequirementConfig[]> {
  const items = await Promise.all(
    TEMPLATE_STATUSES.map((s) => getStatusRequirements(s, workflowProfileId, db))
  )
  return items
}

export async function upsertStatusRequirements(
  status: FlowStatus,
  requiredDocs: OrderDocTypeKey[],
  requiredFields: RequirementFieldKey[],
  workflowProfileId?: string | null,
  db: DbClient = prisma
): Promise<StatusRequirementConfig> {
  const docs = sanitizeRequirementDocs(requiredDocs)
  const fields = sanitizeRequirementFields(requiredFields)

  if (workflowProfileId) {
    await db.workflowProfileRequirementTemplate.upsert({
      where: {
        workflowProfileId_status: {
          workflowProfileId,
          status: asOrderStatus(status),
        },
      },
      create: {
        workflowProfileId,
        status: asOrderStatus(status),
        requiredDocs: docs,
        requiredFields: fields,
      },
      update: {
        requiredDocs: docs,
        requiredFields: fields,
      },
    })
  } else {
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
  }

  return {
    status,
    requiredDocs: docs,
    requiredFields: fields,
    source: 'custom',
    workflowProfileId: workflowProfileId ?? null,
  }
}

export async function resetStatusRequirements(
  status: FlowStatus,
  workflowProfileId?: string | null,
  db: DbClient = prisma
) {
  if (workflowProfileId) {
    await db.workflowProfileRequirementTemplate.deleteMany({
      where: { workflowProfileId, status: asOrderStatus(status) },
    })
  } else {
    await db.orderStatusRequirementTemplate.deleteMany({
      where: { status: asOrderStatus(status) },
    })
  }
  const defaults = defaultRequirementsForStatus(status)
  return { ...defaults, source: 'default' as const, workflowProfileId: workflowProfileId ?? null }
}

export async function createWorkflowProfile(
  name: string,
  db: DbClient = prisma
): Promise<WorkflowProfileSummary> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Profile name is required')
  }

  const effectiveGlobal = await listTemplateRequirements(null, db)
  const unique = await uniqueWorkflowProfileNameAndSlug(trimmed, db)

  const profile = await db.$transaction(async (tx) => {
    const created = await tx.workflowProfile.create({
      data: {
        name: unique.name,
        slug: unique.slug,
      },
      select: { id: true, slug: true, name: true, active: true },
    })

    if (effectiveGlobal.length) {
      await tx.workflowProfileRequirementTemplate.createMany({
        data: effectiveGlobal.map((item) => ({
          workflowProfileId: created.id,
          status: asOrderStatus(item.status),
          requiredDocs: item.requiredDocs,
          requiredFields: item.requiredFields,
        })),
      })
    }

    return created
  })

  return { ...profile, dealerCount: 0, dealerNames: [] }
}

export async function duplicateWorkflowProfile(
  sourceProfileId: string,
  name: string,
  db: DbClient = prisma
): Promise<WorkflowProfileSummary> {
  const source = await db.workflowProfile.findUnique({
    where: { id: sourceProfileId },
    select: { id: true, name: true },
  })

  if (!source) {
    throw new Error('Source workflow profile not found')
  }

  const trimmed = name.trim() || `${source.name} Copy`
  const unique = await uniqueWorkflowProfileNameAndSlug(trimmed, db)
  const effective = await listTemplateRequirements(sourceProfileId, db)

  const profile = await db.$transaction(async (tx) => {
    const created = await tx.workflowProfile.create({
      data: {
        name: unique.name,
        slug: unique.slug,
      },
      select: { id: true, slug: true, name: true, active: true },
    })

    if (effective.length) {
      await tx.workflowProfileRequirementTemplate.createMany({
        data: effective.map((item) => ({
          workflowProfileId: created.id,
          status: asOrderStatus(item.status),
          requiredDocs: item.requiredDocs,
          requiredFields: item.requiredFields,
        })),
      })
    }

    return created
  })

  return { ...profile, dealerCount: 0, dealerNames: [] }
}

export async function renameWorkflowProfile(
  profileId: string,
  name: string,
  db: DbClient = prisma
): Promise<WorkflowProfileSummary> {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Profile name is required')
  }

  const profile = await db.workflowProfile.findUnique({
    where: { id: profileId },
    select: { id: true, slug: true, active: true, dealers: { orderBy: { name: 'asc' }, select: { name: true } } },
  })

  if (!profile) {
    throw new Error('Workflow profile not found')
  }

  const unique = await uniqueWorkflowProfileNameAndSlug(trimmed, db, profileId)
  const updated = await db.workflowProfile.update({
    where: { id: profileId },
    data: { name: unique.name },
    select: {
      id: true,
      slug: true,
      name: true,
      active: true,
      dealers: { orderBy: { name: 'asc' }, select: { name: true } },
    },
  })

  return {
    id: updated.id,
    slug: updated.slug,
    name: updated.name,
    active: updated.active,
    dealerCount: updated.dealers.length,
    dealerNames: updated.dealers.map((dealer) => dealer.name),
  }
}
