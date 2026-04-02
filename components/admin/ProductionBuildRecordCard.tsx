'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ClipboardPenLine, Factory, FlaskConical, Save, X } from 'lucide-react'

type BuildMaterialCategory = 'GEL_COAT' | 'SKIN_RESIN' | 'BUILD_UP_RESIN' | 'CHOP' | 'OIL'

type MaterialUsage = {
  id?: string
  category: BuildMaterialCategory
  slotLabel: string
  sortOrder: number
  batchNumber?: string | null
  startWeight?: number | null
  finishWeight?: number | null
  netWeight?: number | null
  totalWeight?: number | null
}

type BuildRecord = {
  id: string
  orderId: string
  dateBuilt?: string | null
  gelGunOperator?: string | null
  chopGunOperator?: string | null
  outsideTemp?: string | null
  moldTemp?: string | null
  buildTeam?: string | null
  shellWeight?: number | null
  buildHours?: number | null
  notes?: string | null
  materialUsages: MaterialUsage[]
}

type BuildRecordResponse = {
  record: BuildRecord | null
  defaults: MaterialUsage[]
}

type Props = {
  orderId: string
  currentSerialNumber?: string | null
  onSaved?: () => Promise<void> | void
}

type FormState = {
  dateBuilt: string
  gelGunOperator: string
  chopGunOperator: string
  outsideTemp: string
  moldTemp: string
  buildTeam: string
  shellWeight: string
  buildHours: string
  notes: string
  materialUsages: MaterialUsage[]
}

const SECTION_META: Record<BuildMaterialCategory, { title: string; accent: string }> = {
  GEL_COAT: { title: 'Gel Coat', accent: 'border-sky-200 bg-sky-50' },
  SKIN_RESIN: { title: 'Skin 1/4 Resin', accent: 'border-cyan-200 bg-cyan-50' },
  BUILD_UP_RESIN: { title: 'Build Up Resin', accent: 'border-indigo-200 bg-indigo-50' },
  CHOP: { title: 'Chop', accent: 'border-violet-200 bg-violet-50' },
  OIL: { title: 'Weight / Volume Used', accent: 'border-amber-200 bg-amber-50' },
}

function formatDate(value?: string | null) {
  if (!value) return 'Not set'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return 'Not set'
  return d.toLocaleDateString()
}

function toInputDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return String(value)
}

function emptyForm(currentSerialNumber?: string | null): FormState {
  return {
    dateBuilt: '',
    gelGunOperator: '',
    chopGunOperator: '',
    outsideTemp: '',
    moldTemp: '',
    buildTeam: '',
    shellWeight: '',
    buildHours: '',
    notes: '',
    materialUsages: [],
  }
}

function mapRecordToForm(record: BuildRecord | null, defaults: MaterialUsage[], currentSerialNumber?: string | null): FormState {
  if (!record) {
    return {
      ...emptyForm(currentSerialNumber),
      materialUsages: defaults.map((row) => ({ ...row })),
    }
  }

  const fallbackRows = defaults.map((row) => ({ ...row }))
  const mergedRows = fallbackRows.map((row) => {
    const existing = record.materialUsages.find(
      (candidate) => candidate.category === row.category && candidate.slotLabel === row.slotLabel,
    )
    return existing ? { ...existing } : row
  })

  record.materialUsages.forEach((row) => {
    if (!mergedRows.some((candidate) => candidate.category === row.category && candidate.slotLabel === row.slotLabel)) {
      mergedRows.push({ ...row })
    }
  })

  return {
    dateBuilt: toInputDate(record.dateBuilt),
    gelGunOperator: record.gelGunOperator || '',
    chopGunOperator: record.chopGunOperator || '',
    outsideTemp: record.outsideTemp || '',
    moldTemp: record.moldTemp || '',
    buildTeam: record.buildTeam || '',
    shellWeight: record.shellWeight != null ? String(record.shellWeight) : '',
    buildHours: record.buildHours != null ? String(record.buildHours) : '',
    notes: record.notes || '',
    materialUsages: mergedRows.sort((a, b) => a.category.localeCompare(b.category) || a.sortOrder - b.sortOrder),
  }
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? JSON.parse(text) as T : null
  } catch {
    return null
  }
}

export default function ProductionBuildRecordCard({ orderId, currentSerialNumber, onSaved }: Props) {
  const [record, setRecord] = useState<BuildRecord | null>(null)
  const [defaults, setDefaults] = useState<MaterialUsage[]>([])
  const [form, setForm] = useState<FormState>(() => emptyForm(currentSerialNumber))
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/build-record`, { cache: 'no-store' })
      const data = await safeJson<BuildRecordResponse>(res)
      if (!res.ok) throw new Error(data && typeof data === 'object' && 'message' in data ? String((data as any).message) : 'Failed to load build record')
      const defaultsRows = Array.isArray(data?.defaults) ? data.defaults : []
      const nextRecord = data?.record ?? null
      setDefaults(defaultsRows)
      setRecord(nextRecord)
      setForm(mapRecordToForm(nextRecord, defaultsRows, currentSerialNumber))
    } catch (e: any) {
      setError(e?.message || 'Failed to load build record')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    setForm((current) => ({ ...current }))
  }, [currentSerialNumber])

  const groupedRows = useMemo(() => {
    return form.materialUsages.reduce((acc, row) => {
      ;(acc[row.category] ||= []).push(row)
      return acc
    }, {} as Record<BuildMaterialCategory, MaterialUsage[]>)
  }, [form.materialUsages])

  const updateField = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateMaterial = (category: BuildMaterialCategory, slotLabel: string, field: keyof MaterialUsage, value: string) => {
    setForm((current) => ({
      ...current,
      materialUsages: current.materialUsages.map((row) => {
        if (row.category !== category || row.slotLabel !== slotLabel) return row
        const nextValue = field === 'batchNumber' ? (value || null) : (value === '' ? null : Number(value))
        return { ...row, [field]: nextValue }
      }),
    }))
  }

  const cancelEditing = () => {
    setEditing(false)
    setMessage(null)
    setError(null)
    setForm(mapRecordToForm(record, defaults, currentSerialNumber))
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/build-record`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateBuilt: form.dateBuilt || null,
          gelGunOperator: form.gelGunOperator,
          chopGunOperator: form.chopGunOperator,
          outsideTemp: form.outsideTemp,
          moldTemp: form.moldTemp,
          buildTeam: form.buildTeam,
          shellWeight: form.shellWeight,
          buildHours: form.buildHours,
          notes: form.notes,
          materialUsages: form.materialUsages,
        }),
      })
      const data = await safeJson<{ record?: BuildRecord; message?: string }>(res)
      if (!res.ok || !data?.record) {
        throw new Error(data?.message || 'Failed to save build record')
      }
      setRecord(data.record)
      setForm(mapRecordToForm(data.record, defaults, currentSerialNumber))
      setEditing(false)
      setExpanded(false)
      setMessage('Build record saved.')
      await onSaved?.()
    } catch (e: any) {
      setError(e?.message || 'Failed to save build record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-700">Production Build Record</div>
            <div className="mt-1 text-xs text-slate-500">Capture the actual build sheet directly on the order.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Date Built: {formatDate(record?.dateBuilt)}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Serial: {currentSerialNumber || 'Not set'}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Team: {record?.buildTeam || 'Not set'}
              </span>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Shell Weight: {formatNumber(record?.shellWeight)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  <X size={16} />
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? 'Saving…' : 'Save Build Record'}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setExpanded(true)
                  setEditing(true)
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100"
              >
                <ClipboardPenLine size={16} />
                {record ? 'Edit Build Record' : 'Start Build Record'}
              </button>
            )}

            <button
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
      </div>

      {!expanded ? null : <div className="border-t border-slate-100 px-6 py-5">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        ) : (
          <div className="space-y-5">
            {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

            <div className="grid gap-4 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Date Built</div>
                {editing ? (
                  <input value={form.dateBuilt} onChange={(e) => updateField('dateBuilt', e.target.value)} type="date" className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                ) : (
                  <div className="mt-3 text-lg font-bold text-slate-900">{formatDate(record?.dateBuilt)}</div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Shell Weight</div>
                {editing ? (
                  <input value={form.shellWeight} onChange={(e) => updateField('shellWeight', e.target.value)} inputMode="decimal" placeholder="0.0" className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                ) : (
                  <div className="mt-3 text-lg font-bold text-slate-900">{formatNumber(record?.shellWeight)}</div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Build Hours</div>
                {editing ? (
                  <input value={form.buildHours} onChange={(e) => updateField('buildHours', e.target.value)} inputMode="decimal" placeholder="0.0" className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                ) : (
                  <div className="mt-3 text-lg font-bold text-slate-900">{formatNumber(record?.buildHours)}</div>
                )}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {[
                { key: 'gelGunOperator' as const, label: 'Gel Gun Operator', icon: Factory },
                { key: 'chopGunOperator' as const, label: 'Chop Gun Operator', icon: Factory },
                { key: 'buildTeam' as const, label: 'Build Team', icon: Factory },
                { key: 'outsideTemp' as const, label: 'Outside Temp', icon: FlaskConical },
                { key: 'moldTemp' as const, label: 'Mold Temp', icon: FlaskConical },
              ].map((field) => {
                const Icon = field.icon
                return (
                  <div key={field.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                      <Icon size={14} />
                      {field.label}
                    </div>
                    {editing ? (
                      <input value={form[field.key]} onChange={(e) => updateField(field.key, e.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
                    ) : (
                      <div className="mt-3 text-base font-semibold text-slate-900">{record?.[field.key] || 'Not set'}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Build Notes</div>
              {editing ? (
                <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={4} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" placeholder="Capture anything production needs to keep with this shell record." />
              ) : (
                <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{record?.notes || 'No notes recorded.'}</div>
              )}
            </div>

            <div className="space-y-4">
              {Object.entries(SECTION_META).map(([category, meta]) => {
                const rows = groupedRows[category as BuildMaterialCategory] || []
                return (
                  <div key={category} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className={`border-b px-4 py-3 ${meta.accent}`}>
                      <div className="text-sm font-bold text-slate-900">{meta.title}</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-[0.16em] text-[11px]">Section</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-[0.16em] text-[11px]">Batch / Lot</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-[0.16em] text-[11px]">Start Weight</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-[0.16em] text-[11px]">Finish Weight</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-[0.16em] text-[11px]">Net Weight</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-[0.16em] text-[11px]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={`${row.category}-${row.slotLabel}`} className="border-t border-slate-100 align-top">
                              <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{row.slotLabel}</td>
                              {editing ? (
                                <>
                                  <td className="px-4 py-3"><input value={row.batchNumber || ''} onChange={(e) => updateMaterial(row.category, row.slotLabel, 'batchNumber', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" /></td>
                                  <td className="px-4 py-3"><input value={row.startWeight ?? ''} onChange={(e) => updateMaterial(row.category, row.slotLabel, 'startWeight', e.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" /></td>
                                  <td className="px-4 py-3"><input value={row.finishWeight ?? ''} onChange={(e) => updateMaterial(row.category, row.slotLabel, 'finishWeight', e.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" /></td>
                                  <td className="px-4 py-3"><input value={row.netWeight ?? ''} onChange={(e) => updateMaterial(row.category, row.slotLabel, 'netWeight', e.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" /></td>
                                  <td className="px-4 py-3"><input value={row.totalWeight ?? ''} onChange={(e) => updateMaterial(row.category, row.slotLabel, 'totalWeight', e.target.value)} inputMode="decimal" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" /></td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-3 text-slate-700">{row.batchNumber || '—'}</td>
                                  <td className="px-4 py-3 text-slate-700">{formatNumber(row.startWeight)}</td>
                                  <td className="px-4 py-3 text-slate-700">{formatNumber(row.finishWeight)}</td>
                                  <td className="px-4 py-3 text-slate-700">{formatNumber(row.netWeight)}</td>
                                  <td className="px-4 py-3 text-slate-700">{formatNumber(row.totalWeight)}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>}
    </div>
  )
}
