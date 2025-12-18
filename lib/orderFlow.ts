// glimmerglass-order-system/lib/orderFlow.ts
import { OrderDocType } from '@prisma/client'

/**
 * NOTE:
 * - FLOW_ORDER = flujo “normal” hacia adelante (sin CANCELED).
 * - FlowStatus = puede incluir CANCELED porque existe como estado real.
 */
export const FLOW_ORDER = [
  'PENDING_PAYMENT_APPROVAL',
  'APPROVED', // (eventually removed)
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
] as const

export type FlowStatus = (typeof FLOW_ORDER)[number] | 'CANCELED'

export type OrderDocTypeKey = OrderDocType

export const STATUS_LABELS: Record<FlowStatus, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  APPROVED: 'Approved',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

/**
 * Doc labels shown in UI (dealer/admin)
 */
export const DOC_TYPE_LABELS: Partial<Record<OrderDocType, string>> = {
  PROOF_OF_PAYMENT: 'Proof of Payment',
  QUOTE: 'Quote',
  INVOICE: 'Invoice',

  BUILD_SHEET: 'Build Sheet',
  POST_PRODUCTION_MEDIA: 'Post-production Photos/Video',

  SHIPPING_CHECKLIST: 'Shipping Checklist',
  PRE_SHIPPING_MEDIA: 'Pre-shipping Photos/Video',
  BILL_OF_LADING: 'Bill of Lading',
  PROOF_OF_FINAL_PAYMENT: 'Proof of Final Payment',
  PAID_INVOICE: 'Paid Invoice',

  // Optional / future
  // WARRANTY: 'Warranty',
  // MANUAL: 'Manual',
}

export function labelDocType(docType?: string | null): string | null {
  if (!docType) return null
  // docType from DB might be OrderDocType or string
  const key = docType as OrderDocType
  return DOC_TYPE_LABELS[key] ?? docType.replaceAll('_', ' ')
}

/**
 * Mike’s required docs to move INTO a status.
 * Example: to go INTO APPROVED, need payment docs.
 */
export const REQUIRED_FOR: Partial<Record<FlowStatus, OrderDocType[]>> = {
  APPROVED: ['PROOF_OF_PAYMENT', 'QUOTE', 'INVOICE'],
  IN_PRODUCTION: ['BUILD_SHEET', 'POST_PRODUCTION_MEDIA'],
  PRE_SHIPPING: [
    'SHIPPING_CHECKLIST',
    'PRE_SHIPPING_MEDIA',
    'BILL_OF_LADING',
    'PROOF_OF_FINAL_PAYMENT',
    'PAID_INVOICE',
  ],
}

/**
 * Mike: Serial Number required before moving into IN_PRODUCTION (and later too).
 */
export const REQUIRED_FIELDS_FOR: Partial<Record<FlowStatus, Array<'serialNumber'>>> = {
  IN_PRODUCTION: ['serialNumber'],
  PRE_SHIPPING: ['serialNumber'],
  COMPLETED: ['serialNumber'],
}