// glimmerglass-order-system/lib/orderFlow.ts
import type { OrderDocType } from '@prisma/client'

/**
 * ✅ APPROVED eliminado
 * Flujo oficial:
 * PENDING_PAYMENT_APPROVAL -> IN_PRODUCTION -> PRE_SHIPPING -> COMPLETED
 * CANCELED es salida lateral (no forward move)
 */
export type FlowStatus =
  | 'PENDING_PAYMENT_APPROVAL'
  | 'IN_PRODUCTION'
  | 'PRE_SHIPPING'
  | 'COMPLETED'
  | 'CANCELED'

// Solo los pasos "forward" (no incluye CANCELED)
export const FLOW_ORDER: Exclude<FlowStatus, 'CANCELED'>[] = [
  'PENDING_PAYMENT_APPROVAL',
  'IN_PRODUCTION',
  'PRE_SHIPPING',
  'COMPLETED',
]

export const STATUS_LABELS: Record<FlowStatus, string> = {
  PENDING_PAYMENT_APPROVAL: 'Pending Payment Approval',
  IN_PRODUCTION: 'In Production',
  PRE_SHIPPING: 'Pre-Shipping',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
}

/**
 * DocType keys (string union) basado en el enum de Prisma
 * Te sirve para tipar REQUIRED_FOR y para retornar missing docs al frontend.
 */
export type OrderDocTypeKey = OrderDocType

/**
 * Reglas de Mike (sin Approved):
 *
 * Para mover a IN_PRODUCTION (desde Pending) requiere:
 * - Proof of Payment
 * - Quote
 * - Invoice
 * - Build sheet
 * - Post-production photos/video
 * - Serial Number (campo)
 *
 * Para mover a PRE_SHIPPING requiere:
 * - Shipping checklist
 * - Pre-shipping photos/video
 * - Bill of Lading
 * - Proof of Final Payment
 * - Paid invoice
 */
export const REQUIRED_FOR: Partial<Record<FlowStatus, OrderDocTypeKey[]>> = {
  IN_PRODUCTION: [
    'PROOF_OF_PAYMENT',
    'QUOTE',
    'INVOICE',
    'BUILD_SHEET',
    'POST_PRODUCTION_MEDIA',
  ],
  PRE_SHIPPING: [
    'SHIPPING_CHECKLIST',
    'PRE_SHIPPING_MEDIA',
    'BILL_OF_LADING',
    'PROOF_OF_FINAL_PAYMENT',
    'PAID_INVOICE',
  ],
  // COMPLETED: si luego quieres exigir algo, lo agregas aquí
}

// Campos requeridos por status
export const REQUIRED_FIELDS_FOR: Partial<Record<FlowStatus, Array<'serialNumber'>>> = {
  IN_PRODUCTION: ['serialNumber'],
  PRE_SHIPPING: ['serialNumber'],
  COMPLETED: ['serialNumber'],
}

// Labels para doc types (dealer/admin)
export const DOC_TYPE_LABELS: Record<string, string> = {
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

  WARRANTY: 'Warranty',
  MANUAL: 'Manual',
}

export function labelDocType(docType?: string | null) {
  if (!docType) return null
  return DOC_TYPE_LABELS[docType] || docType.replaceAll('_', ' ')
}