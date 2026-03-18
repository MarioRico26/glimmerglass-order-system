import type { OrderDocType } from '@prisma/client'

export type FlowStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

export type LegacyFlowStatus = FlowStatus | 'APPROVED'

// Canonical operational path. APPROVED is treated as legacy data only.
export const FLOW_ORDER: Exclude<FlowStatus, 'CANCELED'>[] = [
  'PENDING_PAYMENT_APPROVAL',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
]

// Si tu Prisma enum OrderDocType es el source of truth, usamos ese tipo directo
export type OrderDocTypeKey = OrderDocType
export const REQUIREMENT_FIELD_KEYS = [
  'serialNumber',
  'requestedShipDate',
  'productionPriority',
] as const
export type RequirementFieldKey = (typeof REQUIREMENT_FIELD_KEYS)[number]

export const STATUS_LABELS: Record<FlowStatus, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

export const LEGACY_STATUS_LABELS: Record<LegacyFlowStatus, string> = {
  ...STATUS_LABELS,
  APPROVED: 'Payment Approved',
}

// Labels bonitos para docs
export const DOC_TYPE_LABELS: Partial<Record<OrderDocTypeKey, string>> = {
  PROOF_OF_PAYMENT: 'Proof of Payment',
  QUOTE: 'Order Form',
  INVOICE: 'Invoice with deposit applied',

  BUILD_SHEET: 'Build Sheet',
  POST_PRODUCTION_MEDIA: 'Post-production Photos/Video',

  SHIPPING_CHECKLIST: 'Shipping Checklist',
  PRE_SHIPPING_MEDIA: 'Pre-shipping Photos/Video',
  BILL_OF_LADING: 'Bill of Lading',
  PROOF_OF_FINAL_PAYMENT: 'Proof of Final Payment',
  PAID_INVOICE: 'Paid Invoice',
}

export const WORKFLOW_DOC_OPTIONS: OrderDocTypeKey[] = [
  'PROOF_OF_PAYMENT',
  'QUOTE',
  'INVOICE',
  'BUILD_SHEET',
  'POST_PRODUCTION_MEDIA',
  'SHIPPING_CHECKLIST',
  'PRE_SHIPPING_MEDIA',
  'BILL_OF_LADING',
  'PROOF_OF_FINAL_PAYMENT',
  'PAID_INVOICE',
]

export function labelDocType(docType?: string | null) {
  if (!docType) return null
  const key = docType as OrderDocTypeKey
  return DOC_TYPE_LABELS[key] || docType.replaceAll('_', ' ')
}

export function isFlowStatus(value: string): value is FlowStatus {
  return value in STATUS_LABELS
}

export function isLegacyFlowStatus(value: string): value is LegacyFlowStatus {
  return value in LEGACY_STATUS_LABELS
}

export function normalizeOrderStatus(status?: string | null): FlowStatus | null {
  if (!status) return null
  if (status === 'APPROVED') return 'IN_PRODUCTION'
  return isFlowStatus(status) ? status : null
}

export function labelOrderStatus(
  status?: string | null,
  options?: { preserveLegacyApproved?: boolean }
) {
  if (!status) return ''
  if (options?.preserveLegacyApproved && status === 'APPROVED') {
    return LEGACY_STATUS_LABELS.APPROVED
  }
  const normalized = normalizeOrderStatus(status)
  if (normalized) return STATUS_LABELS[normalized]
  if (isLegacyFlowStatus(status)) return LEGACY_STATUS_LABELS[status]
  return status.replaceAll('_', ' ')
}

/**
 * REGLAS de Mike:
 *
 * Pending Payment Approval -> In Production requiere:
 *  - Proof of Payment
 *  - Order Form
 *  - Invoice with deposit applied
 *
 * In Production -> Pre-Shipping requiere:
 *  - Build sheet
 *  - Post-production photos/video
 *  - Serial Number (campo)
 *
 * Pre-Shipping -> Completed requiere:
 *  - Shipping checklist
 *  - Pre-shipping photos/video
 *  - Bill of Lading
 *  - Proof of Final Payment
 *  - Paid invoice
 */
export const REQUIRED_FOR: Partial<Record<FlowStatus, OrderDocTypeKey[]>> = {
  IN_PRODUCTION: ['PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE'],
  PRE_SHIPPING: ['BUILD_SHEET', 'POST_PRODUCTION_MEDIA'],
  COMPLETED: [
    'SHIPPING_CHECKLIST',
    'PRE_SHIPPING_MEDIA',
    'BILL_OF_LADING',
    'PROOF_OF_FINAL_PAYMENT',
    'PAID_INVOICE',
  ],
}

export const REQUIRED_FIELDS_FOR: Partial<Record<FlowStatus, RequirementFieldKey[]>> = {
  PRE_SHIPPING: ['serialNumber'],
  COMPLETED: ['serialNumber'],
}
