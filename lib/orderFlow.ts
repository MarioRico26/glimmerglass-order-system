// glimmerglass-order-system/lib/orderFlow.ts
import type { OrderDocType } from '@prisma/client'

// ✅ Statuses del flow (APPROVED eliminado)
export type FlowStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

// Orden del “camino” normal (CANCELED no forma parte del forward flow)
export const FLOW_ORDER: Exclude<FlowStatus, 'CANCELED'>[] = [
  'PENDING_PAYMENT_APPROVAL',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
]

// Si tu Prisma enum OrderDocType es el source of truth, usamos ese tipo directo
export type OrderDocTypeKey = OrderDocType

export const STATUS_LABELS: Record<FlowStatus, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

// Labels bonitos para docs
export const DOC_TYPE_LABELS: Partial<Record<OrderDocTypeKey, string>> = {
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
}

export function labelDocType(docType?: string | null) {
  if (!docType) return null
  const key = docType as OrderDocTypeKey
  return DOC_TYPE_LABELS[key] || docType.replaceAll('_', ' ')
}

/**
 * REGLAS de Mike (sin APPROVED):
 *
 * Pending -> In Production requiere:
 *  - Proof of Payment, Quote, Invoice
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

export const REQUIRED_FIELDS_FOR: Partial<Record<FlowStatus, Array<'serialNumber'>>> = {
  PRE_SHIPPING: ['serialNumber'], // Mike: serial antes de Pre-Shipping
  COMPLETED: ['serialNumber'],
}