'use client'

import React from 'react'

type Props = {
  open: boolean
  onClose: () => void
  targetStatus?: string | null
  missingDocs?: string[]
  missingFields?: string[]
  goToUploadHref?: string | null
}

const DOC_LABELS: Record<string, string> = {
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

  OTHER: 'Other',
}

function prettyStatus(s?: string | null) {
  if (!s) return ''
  return s.replaceAll('_', ' ')
}

function prettyField(f: string) {
  if (f === 'serialNumber') return 'Serial Number'
  if (f === 'requestedShipDate') return 'Requested Ship Date'
  if (f === 'productionPriority') return 'Production Priority'
  return f.replaceAll('_', ' ')
}

export default function MissingRequirementsModal({
  open,
  onClose,
  targetStatus,
  missingDocs = [],
  missingFields = [],
  goToUploadHref = null,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Missing requirements</h3>
          <p className="text-sm text-slate-600 mt-1">
            You can’t move this order to{' '}
            <span className="font-semibold">{prettyStatus(targetStatus)}</span> until these are done.
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {missingDocs.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-bold text-amber-900 mb-2">Required documents missing</div>
              <ul className="list-disc ml-5 text-sm text-amber-900 space-y-1">
                {missingDocs.map((d) => (
                  <li key={d}>{DOC_LABELS[d] || d.replaceAll('_', ' ')}</li>
                ))}
              </ul>
            </div>
          )}

          {missingFields.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-sm font-bold text-rose-900 mb-2">Required fields missing</div>
              <ul className="list-disc ml-5 text-sm text-rose-900 space-y-1">
                {missingFields.map((f) => (
                  <li key={f}>{prettyField(f)}</li>
                ))}
              </ul>
            </div>
          )}

          {missingDocs.length === 0 && missingFields.length === 0 && (
            <div className="text-sm text-slate-600">
              Server didn’t provide details (cool). Check backend response format.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
          {goToUploadHref && (
            <a
              href={goToUploadHref}
              className="rounded-xl px-4 py-2 text-sm font-bold bg-sky-700 text-white hover:bg-sky-800"
            >
              Go to Upload
            </a>
          )}
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-bold border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}