import { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  REQUIRED_FIELDS_FOR,
  REQUIRED_FOR,
  REQUIREMENT_FIELD_KEYS,
  type FlowStatus,
  type RequirementFieldKey,
} from '@/lib/orderFlow'
import { getWorkflowDocDefinitionMap } from '@/lib/workflowDocConfig'

type RequirementSource = 'default' | 'custom'
export type RequirementDocKey = string

export type StatusRequirementConfig = {
  status: FlowStatus
  requiredDocs: RequirementDocKey[]
  requiredFields: RequirementFieldKey[]
  source: RequirementSource
  workflowProfileId?: string | null
}

type DbClient = Pick<
  typeof prisma,
  | 'orderStatusRequirementTemplate'
  | 'workflowProfileRequirementTemplate'
  | 'workflowProfile'
  | 'workflowDocumentDefinition'
  | 'orderStatusRequirementDocument'
  | 'workflowProfileRequirementDocument'
  | 'orderMedia'
  | '$transaction'
>

export const TEMPLATE_STATUSES: FlowStatus[] = [
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
  'SERVICE_WARRANTY',
]

const templateStatusSet = new Set<FlowStatus>(TEMPLATE_STATUSES)
const validFieldSet = new Set<RequirementFieldKey>(REQUIREMENT_FIELD_KEYS)

export type WorkflowProfileSummary = {
  id: string
  slug: string
  name: string
  active: boolean
  dealerCount: number
  dealerNames: string[]
}

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

export function sanitizeRequirementDocs(value: unknown): RequirementDocKey[] {
  if (!Array.isArray(value)) return []
  return uniq(value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim()))
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

async function resolveDocRequirements(
  status: FlowStatus,
  workflowProfileId: string | null,
  db: DbClient,
) {
  const definitionMap = await getWorkflowDocDefinitionMap(db)

  if (workflowProfileId) {
    const [template, customDocs] = await Promise.all([
      db.workflowProfileRequirementTemplate.findUnique({
        where: {
          workflowProfileId_status: {
            workflowProfileId,
            status: asOrderStatus(status),
          },
        },
        select: { requiredDocs: true, requiredFields: true },
      }),
      db.workflowProfileRequirementDocument.findMany({
        where: { workflowProfileId, status: asOrderStatus(status) },
        select: { documentDefinition: { select: { key: true } } },
      }),
    ])

    if (template || customDocs.length) {
      return {
        source: 'custom' as const,
        requiredDocs: uniq([
          ...sanitizeRequirementDocs(template?.requiredDocs ?? []),
          ...customDocs.map((row) => row.documentDefinition.key),
        ]),
        requiredFields: sanitizeRequirementFields(template?.requiredFields ?? []),
      }
    }
  }

  const [globalTemplate, globalCustomDocs] = await Promise.all([
    db.orderStatusRequirementTemplate.findUnique({
      where: { status: asOrderStatus(status) },
      select: { requiredDocs: true, requiredFields: true },
    }),
    db.orderStatusRequirementDocument.findMany({
      where: { status: asOrderStatus(status) },
      select: { documentDefinition: { select: { key: true } } },
    }),
  ])

  if (!globalTemplate && globalCustomDocs.length === 0) {
    const defaults = defaultRequirementsForStatus(status)
    return { source: 'default' as const, requiredDocs: defaults.requiredDocs, requiredFields: defaults.requiredFields }
  }

  const legacyDocs = sanitizeRequirementDocs(globalTemplate?.requiredDocs ?? [])
  const normalizedLegacyDocs = legacyDocs.filter((key) => !!definitionMap[key])

  return {
    source: 'custom' as const,
    requiredDocs: uniq([...normalizedLegacyDocs, ...globalCustomDocs.map((row) => row.documentDefinition.key)]),
    requiredFields: sanitizeRequirementFields(globalTemplate?.requiredFields ?? []),
  }
}

async function splitRequirementDocs(requiredDocs: RequirementDocKey[], db: DbClient) {
  const definitionMap = await getWorkflowDocDefinitionMap(db)
  const valid = uniq(requiredDocs.filter((key) => !!definitionMap[key]))

  return {
    validKeys: valid,
    legacyDocTypes: valid
      .map((key) => definitionMap[key])
      .filter((item) => !!item?.legacyDocType)
      .map((item) => item.legacyDocType as string),
    customDefinitionIds: valid
      .map((key) => definitionMap[key])
      .filter((item) => item && !item.legacyDocType)
      .map((item) => item.id),
  }
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
  db: DbClient = prisma,
): Promise<StatusRequirementConfig> {
  const resolved = await resolveDocRequirements(status, workflowProfileId ?? null, db)
  return {
    status,
    requiredDocs: resolved.requiredDocs,
    requiredFields: resolved.requiredFields,
    source: resolved.source,
    workflowProfileId: workflowProfileId ?? null,
  }
}

export async function listTemplateRequirements(
  workflowProfileId?: string | null,
  db: DbClient = prisma,
): Promise<StatusRequirementConfig[]> {
  const items = await Promise.all(TEMPLATE_STATUSES.map((s) => getStatusRequirements(s, workflowProfileId, db)))
  return items
}

export async function listPresentOrderDocumentKeys(
  orderId: string,
  db: DbClient = prisma,
): Promise<Set<string>> {
  const media = await db.orderMedia.findMany({
    where: { orderId },
    select: {
      docType: true,
      documentDefinition: {
        select: {
          key: true,
          legacyDocType: true,
        },
      },
    },
  })

  const present = new Set<string>()
  for (const item of media) {
    if (item.documentDefinition?.key) present.add(item.documentDefinition.key)
    if (item.documentDefinition?.legacyDocType) present.add(item.documentDefinition.legacyDocType)
    if (item.docType) present.add(item.docType)
  }

  return present
}

export async function upsertStatusRequirements(
  status: FlowStatus,
  requiredDocs: RequirementDocKey[],
  requiredFields: RequirementFieldKey[],
  workflowProfileId?: string | null,
  db: DbClient = prisma,
): Promise<StatusRequirementConfig> {
  const fields = sanitizeRequirementFields(requiredFields)
  const docs = sanitizeRequirementDocs(requiredDocs)
  const split = await splitRequirementDocs(docs, db)

  if (workflowProfileId) {
    await db.$transaction(async (tx) => {
      await tx.workflowProfileRequirementTemplate.upsert({
        where: {
          workflowProfileId_status: {
            workflowProfileId,
            status: asOrderStatus(status),
          },
        },
        create: {
          workflowProfileId,
          status: asOrderStatus(status),
          requiredDocs: split.legacyDocTypes as any,
          requiredFields: fields,
        },
        update: {
          requiredDocs: split.legacyDocTypes as any,
          requiredFields: fields,
        },
      })

      await tx.workflowProfileRequirementDocument.deleteMany({
        where: { workflowProfileId, status: asOrderStatus(status) },
      })

      if (split.customDefinitionIds.length) {
        await tx.workflowProfileRequirementDocument.createMany({
          data: split.customDefinitionIds.map((documentDefinitionId) => ({
            workflowProfileId,
            status: asOrderStatus(status),
            documentDefinitionId,
          })),
        })
      }
    })
  } else {
    await db.$transaction(async (tx) => {
      await tx.orderStatusRequirementTemplate.upsert({
        where: { status: asOrderStatus(status) },
        create: {
          status: asOrderStatus(status),
          requiredDocs: split.legacyDocTypes as any,
          requiredFields: fields,
        },
        update: {
          requiredDocs: split.legacyDocTypes as any,
          requiredFields: fields,
        },
      })

      await tx.orderStatusRequirementDocument.deleteMany({
        where: { status: asOrderStatus(status) },
      })

      if (split.customDefinitionIds.length) {
        await tx.orderStatusRequirementDocument.createMany({
          data: split.customDefinitionIds.map((documentDefinitionId) => ({
            status: asOrderStatus(status),
            documentDefinitionId,
          })),
        })
      }
    })
  }

  return {
    status,
    requiredDocs: split.validKeys,
    requiredFields: fields,
    source: 'custom',
    workflowProfileId: workflowProfileId ?? null,
  }
}

export async function resetStatusRequirements(
  status: FlowStatus,
  workflowProfileId?: string | null,
  db: DbClient = prisma,
) {
  if (workflowProfileId) {
    await db.$transaction(async (tx) => {
      await tx.workflowProfileRequirementTemplate.deleteMany({
        where: { workflowProfileId, status: asOrderStatus(status) },
      })
      await tx.workflowProfileRequirementDocument.deleteMany({
        where: { workflowProfileId, status: asOrderStatus(status) },
      })
    })
  } else {
    await db.$transaction(async (tx) => {
      await tx.orderStatusRequirementTemplate.deleteMany({
        where: { status: asOrderStatus(status) },
      })
      await tx.orderStatusRequirementDocument.deleteMany({
        where: { status: asOrderStatus(status) },
      })
    })
  }

  const defaults = defaultRequirementsForStatus(status)
  return { ...defaults, source: 'default' as const, workflowProfileId: workflowProfileId ?? null }
}

export async function createWorkflowProfile(
  name: string,
  db: DbClient = prisma,
): Promise<WorkflowProfileSummary> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Profile name is required')

  const effectiveGlobal = await listTemplateRequirements(null, db)
  const unique = await uniqueWorkflowProfileNameAndSlug(trimmed, db)

  const profile = await db.$transaction(async (tx) => {
    const created = await tx.workflowProfile.create({
      data: { name: unique.name, slug: unique.slug },
      select: { id: true, slug: true, name: true, active: true },
    })

    for (const item of effectiveGlobal) {
      await upsertStatusRequirements(item.status, item.requiredDocs, item.requiredFields, created.id, tx as unknown as DbClient)
    }

    return created
  })

  return { ...profile, dealerCount: 0, dealerNames: [] }
}

export async function duplicateWorkflowProfile(
  sourceProfileId: string,
  name: string,
  db: DbClient = prisma,
): Promise<WorkflowProfileSummary> {
  const source = await db.workflowProfile.findUnique({
    where: { id: sourceProfileId },
    select: { id: true, name: true },
  })
  if (!source) throw new Error('Source workflow profile not found')

  const trimmed = name.trim() || `${source.name} Copy`
  const unique = await uniqueWorkflowProfileNameAndSlug(trimmed, db)
  const effective = await listTemplateRequirements(sourceProfileId, db)

  const profile = await db.$transaction(async (tx) => {
    const created = await tx.workflowProfile.create({
      data: { name: unique.name, slug: unique.slug },
      select: { id: true, slug: true, name: true, active: true },
    })

    for (const item of effective) {
      await upsertStatusRequirements(item.status, item.requiredDocs, item.requiredFields, created.id, tx as unknown as DbClient)
    }

    return created
  })

  return { ...profile, dealerCount: 0, dealerNames: [] }
}

export async function renameWorkflowProfile(
  profileId: string,
  name: string,
  db: DbClient = prisma,
): Promise<WorkflowProfileSummary> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Profile name is required')

  const profile = await db.workflowProfile.findUnique({
    where: { id: profileId },
    select: { id: true },
  })
  if (!profile) throw new Error('Workflow profile not found')

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
