export function buildSystemInvoiceRef(orderId: string, createdAt?: string | Date | null) {
  const date = createdAt ? new Date(createdAt) : null
  const datePart =
    date && !Number.isNaN(+date)
      ? `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
      : '00000000'
  const shortId = String(orderId || '').replace(/-/g, '').slice(0, 6).toUpperCase() || 'ORDER'
  return `INV-${datePart}-${shortId}`
}

export function displayInvoiceRef(invoiceNumber: string | null | undefined, orderId: string, createdAt?: string | Date | null) {
  if (invoiceNumber && invoiceNumber.trim()) return invoiceNumber.trim()
  return buildSystemInvoiceRef(orderId, createdAt)
}
