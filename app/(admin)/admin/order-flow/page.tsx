'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, GripVertical, RefreshCw, Save, RotateCcw } from 'lucide-react'
import { STATUS_LABELS, labelDocType, type FlowStatus } from '@/lib/orderFlow'

type RequirementItem = {
  status: FlowStatus
  requiredDocs: string[]
  requiredFields: string[]
  source: 'default' | 'custom'
}

type StatusOption = { value: FlowStatus; label: string }
type DocOption = { value: string; label: string; sortOrder?: number; source?: 'default' | 'custom' }
type FieldOption = { value: string }

type ApiPayload = {
  items: RequirementItem[]
  options: {
    statuses: StatusOption[]
    docs: DocOption[]
    fields: FieldOption[]
  }
}

function prettyField(field: string) {
  if (field === 'serialNumber') return 'Serial Number'
  if (field === 'requestedShipDate') return 'Requested Ship Date'
  if (field === 'productionPriority') return 'Production Priority'
  return field.replaceAll('_', ' ')
}

function statusLabel(status: FlowStatus) {
  return STATUS_LABELS[status] || status.replaceAll('_', ' ')
}

export default function AdminOrderFlowRequirementsPage() {
  const [items, setItems] = useState<RequirementItem[]>([])
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([])
  const [docOptions, setDocOptions] = useState<DocOption[]>([])
  const [fieldOptions, setFieldOptions] = useState<FieldOption[]>([])
  const [loading, setLoading] = useState(true)
  const [busyStatus, setBusyStatus] = useState<FlowStatus | null>(null)
  const [savingLabels, setSavingLabels] = useState(false)
  const [dragDocValue, setDragDocValue] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.status, item] as const)),
    [items]
  )

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/admin/order-flow/requirements', { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as ApiPayload | null
      if (!res.ok || !data) throw new Error('Failed to load workflow requirements')

      setItems(Array.isArray(data.items) ? data.items : [])
      setStatusOptions(Array.isArray(data.options?.statuses) ? data.options.statuses : [])
      setDocOptions(Array.isArray(data.options?.docs) ? data.options.docs : [])
      setFieldOptions(Array.isArray(data.options?.fields) ? data.options.fields : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load workflow requirements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function updateLocal(status: FlowStatus, patch: Partial<RequirementItem>) {
    setItems((prev) =>
      prev.map((item) => (item.status === status ? { ...item, ...patch } : item))
    )
  }

  function toggleDoc(status: FlowStatus, doc: string) {
    const current = itemMap.get(status)
    if (!current) return
    const has = current.requiredDocs.includes(doc)
    const next = has
      ? current.requiredDocs.filter((d) => d !== doc)
      : [...current.requiredDocs, doc]
    updateLocal(status, { requiredDocs: next })
  }

  function toggleField(status: FlowStatus, field: string) {
    const current = itemMap.get(status)
    if (!current) return
    const has = current.requiredFields.includes(field)
    const next = has
      ? current.requiredFields.filter((f) => f !== field)
      : [...current.requiredFields, field]
    updateLocal(status, { requiredFields: next })
  }

  function updateDocLabel(docType: string, label: string) {
    setDocOptions((prev) =>
      prev.map((doc) => (doc.value === docType ? { ...doc, label } : doc))
    )
  }

  function moveDocOption(fromValue: string, toValue: string) {
    if (fromValue === toValue) return

    setDocOptions((prev) => {
      const next = [...prev]
      const fromIndex = next.findIndex((doc) => doc.value === fromValue)
      const toIndex = next.findIndex((doc) => doc.value === toValue)
      if (fromIndex === -1 || toIndex === -1) return prev

      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)

      return next.map((doc, index) => ({ ...doc, sortOrder: index }))
    })
  }

  async function saveStatus(status: FlowStatus) {
    const current = itemMap.get(status)
    if (!current) return
    try {
      setBusyStatus(status)
      setError(null)
      setMessage(null)
      const res = await fetch('/api/admin/order-flow/requirements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          requiredDocs: current.requiredDocs,
          requiredFields: current.requiredFields,
        }),
      })
      const payload = (await res.json().catch(() => null)) as RequirementItem | { message?: string } | null
      if (!res.ok || !payload || !('status' in payload)) {
        const msg = payload && 'message' in payload ? payload.message : 'Failed to save requirements'
        throw new Error(msg || 'Failed to save requirements')
      }

      updateLocal(status, {
        requiredDocs: payload.requiredDocs,
        requiredFields: payload.requiredFields,
        source: payload.source,
      })
      setMessage(`${statusLabel(status)} requirements saved.`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save requirements')
    } finally {
      setBusyStatus(null)
    }
  }

  async function resetStatus(status: FlowStatus) {
    try {
      setBusyStatus(status)
      setError(null)
      setMessage(null)
      const res = await fetch(
        `/api/admin/order-flow/requirements?status=${encodeURIComponent(status)}`,
        { method: 'DELETE' }
      )
      const payload = (await res.json().catch(() => null)) as RequirementItem | { message?: string } | null
      if (!res.ok || !payload || !('status' in payload)) {
        const msg = payload && 'message' in payload ? payload.message : 'Failed to reset requirements'
        throw new Error(msg || 'Failed to reset requirements')
      }

      updateLocal(status, {
        requiredDocs: payload.requiredDocs,
        requiredFields: payload.requiredFields,
        source: payload.source,
      })
      setMessage(`${statusLabel(status)} requirements reset to default.`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reset requirements')
    } finally {
      setBusyStatus(null)
    }
  }

  async function saveDocLabels() {
    try {
      setSavingLabels(true)
      setError(null)
      setMessage(null)

      const res = await fetch('/api/admin/order-flow/requirements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docs: docOptions.map((doc) => ({
            docType: doc.value,
            label: doc.label,
            sortOrder: doc.sortOrder ?? 0,
          })),
        }),
      })
      const payload = (await res.json().catch(() => null)) as
        | {
            items?: Array<{
              docType: string
              label: string
              sortOrder?: number
              source?: 'default' | 'custom'
            }>
            message?: string
          }
        | null

      if (!res.ok || !payload?.items) {
        throw new Error(payload?.message || 'Failed to save document labels')
      }

      setDocOptions(
        payload.items.map((item) => ({
          value: item.docType,
          label: item.label,
          sortOrder: item.sortOrder,
          source: item.source,
        }))
      )
      setMessage('Document labels saved.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save document labels')
    } finally {
      setSavingLabels(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900">Workflow Requirements</h1>
            <p className="text-slate-600 mt-1">
              Configure required documents and fields before an order can move to the next workflow stage.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white p-5 h-64 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Document Labels</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Edit visible names and drag to reorder. Internal document keys stay stable.
                </p>
              </div>
              <button
                onClick={() => void saveDocLabels()}
                disabled={savingLabels}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-60"
              >
                <Save size={16} />
                {savingLabels ? 'Saving...' : 'Save Labels'}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {docOptions.map((doc) => (
                <label
                  key={`doc-label-${doc.value}`}
                  draggable
                  onDragStart={() => setDragDocValue(doc.value)}
                  onDragEnd={() => setDragDocValue(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragDocValue) return
                    moveDocOption(dragDocValue, doc.value)
                    setDragDocValue(null)
                  }}
                  className={[
                    'rounded-xl border bg-slate-50 p-3',
                    dragDocValue === doc.value
                      ? 'border-sky-300 ring-2 ring-sky-200'
                      : 'border-slate-200',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {doc.value}
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <GripVertical size={14} />
                      Drag
                    </div>
                  </div>
                  <input
                    value={doc.label}
                    onChange={(e) => updateDocLabel(doc.value, e.target.value)}
                    className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200"
                  />
                  <div className="mt-2 text-[11px] text-slate-500">
                    Order: <span className="font-semibold">{doc.sortOrder ?? 0}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    Source: <span className="font-semibold uppercase">{doc.source || 'default'}</span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
          {statusOptions.map((statusOption) => {
            const item = itemMap.get(statusOption.value)
            if (!item) return null
            const isBusy = busyStatus === statusOption.value

            return (
              <section
                key={statusOption.value}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {statusOption.label}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Source:{' '}
                      <span className="font-semibold uppercase tracking-wide">
                        {item.source}
                      </span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700">
                    <CheckCircle2 size={14} />
                    {item.requiredDocs.length + item.requiredFields.length} rules
                  </span>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                      Required Documents
                    </div>
                    <div className="grid gap-2">
                      {docOptions.map((doc) => {
                        const checked = item.requiredDocs.includes(doc.value)
                        return (
                          <label
                            key={`${statusOption.value}-${doc.value}`}
                            className="inline-flex items-center gap-2 text-sm text-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleDoc(statusOption.value, doc.value)}
                              className="accent-sky-600"
                            />
                            {doc.label || labelDocType(doc.value) || doc.value}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">
                      Required Fields
                    </div>
                    <div className="grid gap-2">
                      {fieldOptions.map((field) => {
                        const checked = item.requiredFields.includes(field.value)
                        return (
                          <label
                            key={`${statusOption.value}-${field.value}`}
                            className="inline-flex items-center gap-2 text-sm text-slate-800"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleField(statusOption.value, field.value)}
                              className="accent-sky-600"
                            />
                            {prettyField(field.value)}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void resetStatus(statusOption.value)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RotateCcw size={14} />
                    Reset Default
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveStatus(statusOption.value)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <Save size={14} />
                    Save
                  </button>
                </div>
              </section>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}
