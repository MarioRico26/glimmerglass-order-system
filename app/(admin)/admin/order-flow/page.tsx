'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Copy,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  RotateCcw,
} from 'lucide-react'
import { STATUS_LABELS, labelDocType, type FlowStatus } from '@/lib/orderFlow'

type RequirementItem = {
  status: FlowStatus
  requiredDocs: string[]
  requiredFields: string[]
  source: 'default' | 'custom'
}

type StatusOption = { value: FlowStatus; label: string }
type DocOption = {
  id: string
  value: string
  key: string
  label: string
  sortOrder?: number
  source?: 'legacy' | 'custom'
  legacyDocType?: string | null
  visibleToDealerDefault?: boolean
}
type FieldOption = { value: string }

type ApiPayload = {
  items: RequirementItem[]
  options: {
    profiles?: Array<{ id: string; slug: string; name: string; dealerCount: number; dealerNames: string[] }>
    statuses: StatusOption[]
    docs: DocOption[]
    fields: FieldOption[]
  }
  selectedProfileId?: string | null
}

type ProfileManagerState =
  | { mode: 'create'; title: string; submitLabel: string; defaultName: string; sourceProfileId?: string | null }
  | { mode: 'duplicate'; title: string; submitLabel: string; defaultName: string; sourceProfileId: string }
  | { mode: 'rename'; title: string; submitLabel: string; defaultName: string; sourceProfileId: string }
  | null

type DocumentManagerState =
  | { title: string; submitLabel: string }
  | null

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
  const [workflowProfiles, setWorkflowProfiles] = useState<Array<{ id: string; slug: string; name: string; dealerCount: number; dealerNames: string[] }>>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyStatus, setBusyStatus] = useState<FlowStatus | null>(null)
  const [savingLabels, setSavingLabels] = useState(false)
  const [dragDocValue, setDragDocValue] = useState<string | null>(null)
  const [docLabelsOpen, setDocLabelsOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [profileManager, setProfileManager] = useState<ProfileManagerState>(null)
  const [profileName, setProfileName] = useState('')
  const [profileBusy, setProfileBusy] = useState(false)
  const [documentManager, setDocumentManager] = useState<DocumentManagerState>(null)
  const [documentLabel, setDocumentLabel] = useState('')
  const [documentVisibleToDealer, setDocumentVisibleToDealer] = useState(true)
  const [documentBusy, setDocumentBusy] = useState(false)

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.status, item] as const)),
    [items]
  )
  const activeProfile = useMemo(
    () => workflowProfiles.find((profile) => profile.id === selectedProfileId) || null,
    [workflowProfiles, selectedProfileId]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || (!profileManager && !documentManager)) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mounted, profileManager, documentManager])

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const query = selectedProfileId ? `?profileId=${encodeURIComponent(selectedProfileId)}` : ''
      const [accessRes, res] = await Promise.all([
        fetch('/api/admin/access?module=WORKFLOW_REQUIREMENTS', { cache: 'no-store' }),
        fetch(`/api/admin/order-flow/requirements${query}`, { cache: 'no-store' }),
      ])
      if (accessRes.status === 403) {
        setAccessDenied(true)
        throw new Error('Workflow Requirements access denied')
      }
      const data = (await res.json().catch(() => null)) as ApiPayload | null
      if (!res.ok || !data) throw new Error('Failed to load workflow requirements')

      setItems(Array.isArray(data.items) ? data.items : [])
      setStatusOptions(Array.isArray(data.options?.statuses) ? data.options.statuses : [])
      setDocOptions(Array.isArray(data.options?.docs) ? data.options.docs : [])
      setFieldOptions(Array.isArray(data.options?.fields) ? data.options.fields : [])
      setWorkflowProfiles(Array.isArray(data.options?.profiles) ? data.options.profiles : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load workflow requirements')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [selectedProfileId])

  if (accessDenied) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <h1 className="text-2xl font-black">Workflow Requirements access denied</h1>
        <p className="mt-2 text-sm">This user does not currently have access to the workflow requirements module.</p>
      </div>
    )
  }

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

  function updateDocVisibility(docType: string, visibleToDealerDefault: boolean) {
    setDocOptions((prev) =>
      prev.map((doc) => (doc.value === docType ? { ...doc, visibleToDealerDefault } : doc))
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
          profileId: selectedProfileId || null,
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
      const url = selectedProfileId
        ? `/api/admin/order-flow/requirements?status=${encodeURIComponent(status)}&profileId=${encodeURIComponent(selectedProfileId)}`
        : `/api/admin/order-flow/requirements?status=${encodeURIComponent(status)}`
      const res = await fetch(url, { method: 'DELETE' })
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
            key: doc.value,
            label: doc.label,
            sortOrder: doc.sortOrder ?? 0,
            visibleToDealerDefault: doc.visibleToDealerDefault ?? true,
          })),
        }),
      })
      const payload = (await res.json().catch(() => null)) as
        | {
            items?: Array<{
              id: string
              key: string
              label: string
              sortOrder?: number
              source?: 'legacy' | 'custom'
              legacyDocType?: string | null
              visibleToDealerDefault?: boolean
            }>
            message?: string
          }
        | null

      if (!res.ok || !payload?.items) {
        throw new Error(payload?.message || 'Failed to save document labels')
      }

      setDocOptions(
        payload.items.map((item) => ({
          id: item.id,
          value: item.key,
          key: item.key,
          label: item.label,
          sortOrder: item.sortOrder,
          source: item.source,
          legacyDocType: item.legacyDocType,
          visibleToDealerDefault: item.visibleToDealerDefault,
        }))
      )
      setMessage('Document labels saved.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save document labels')
    } finally {
      setSavingLabels(false)
    }
  }

  function openProfileManager(state: ProfileManagerState) {
    setProfileManager(state)
    setProfileName(state?.defaultName || '')
    setError(null)
    setMessage(null)
  }

  function closeProfileManager() {
    setProfileManager(null)
    setProfileName('')
    setProfileBusy(false)
  }

  function openDocumentManager() {
    setDocumentManager({
      title: 'Create Workflow Document',
      submitLabel: 'Create Document',
    })
    setDocumentLabel('')
    setDocumentVisibleToDealer(true)
    setError(null)
    setMessage(null)
  }

  function closeDocumentManager() {
    setDocumentManager(null)
    setDocumentLabel('')
    setDocumentVisibleToDealer(true)
    setDocumentBusy(false)
  }

  async function submitProfileManager() {
    if (!profileManager) return
    try {
      setProfileBusy(true)
      setError(null)
      setMessage(null)

      if (profileManager.mode === 'rename') {
        const res = await fetch('/api/admin/order-flow/profiles', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: profileManager.sourceProfileId,
            name: profileName,
          }),
        })
        const payload = (await res.json().catch(() => null)) as
          | { profile?: { id: string; name: string } ; message?: string }
          | null
        if (!res.ok || !payload?.profile) throw new Error(payload?.message || 'Failed to rename profile')
        setSelectedProfileId(payload.profile.id)
        setMessage(`Workflow profile renamed to ${payload.profile.name}.`)
      } else {
        const res = await fetch('/api/admin/order-flow/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: profileManager.mode,
            name: profileName,
            sourceProfileId: profileManager.sourceProfileId || null,
          }),
        })
        const payload = (await res.json().catch(() => null)) as
          | { profile?: { id: string; name: string }; message?: string }
          | null
        if (!res.ok || !payload?.profile) throw new Error(payload?.message || 'Failed to create profile')
        setSelectedProfileId(payload.profile.id)
        setMessage(
          profileManager.mode === 'duplicate'
            ? `Workflow profile duplicated as ${payload.profile.name}.`
            : `Workflow profile ${payload.profile.name} created from the global workflow.`
        )
      }

      closeProfileManager()
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save workflow profile')
      setProfileBusy(false)
    }
  }

  async function submitDocumentManager() {
    if (!documentManager) return
    try {
      setDocumentBusy(true)
      setError(null)
      setMessage(null)

      const res = await fetch('/api/admin/order-flow/requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: documentLabel,
          visibleToDealerDefault: documentVisibleToDealer,
        }),
      })

      const payload = (await res.json().catch(() => null)) as
        | {
            id?: string
            key?: string
            label?: string
            sortOrder?: number
            source?: 'legacy' | 'custom'
            legacyDocType?: string | null
            visibleToDealerDefault?: boolean
            message?: string
          }
        | null

      if (!res.ok || !payload?.id || !payload?.key) {
        throw new Error(payload?.message || 'Failed to create workflow document')
      }

      const nextDoc: DocOption = {
        id: payload.id,
        key: payload.key,
        value: payload.key,
        label: payload.label || documentLabel.trim(),
        sortOrder: payload.sortOrder,
        source: payload.source,
        legacyDocType: payload.legacyDocType,
        visibleToDealerDefault: payload.visibleToDealerDefault,
      }

      setDocOptions((prev) => [...prev, nextDoc].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
      setDocLabelsOpen(true)
      setMessage(`Workflow document ${nextDoc.label} created.`)
      closeDocumentManager()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create workflow document')
      setDocumentBusy(false)
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
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {selectedProfileId ? 'Dealer-specific workflow profile' : 'Global default workflow'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900"
            >
              <option value="">Global default workflow</option>
              {workflowProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                openProfileManager({
                  mode: 'create',
                  title: 'Create Workflow Profile',
                  submitLabel: 'Create Profile',
                  defaultName: 'New Workflow Profile',
                })
              }
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold"
            >
              <Plus size={16} />
              New Profile
            </button>
            {activeProfile ? (
              <>
                <button
                  onClick={() =>
                    openProfileManager({
                      mode: 'duplicate',
                      title: 'Duplicate Workflow Profile',
                      submitLabel: 'Duplicate Profile',
                      defaultName: `${activeProfile.name} Copy`,
                      sourceProfileId: activeProfile.id,
                    })
                  }
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  <Copy size={16} />
                  Duplicate
                </button>
                <button
                  onClick={() =>
                    openProfileManager({
                      mode: 'rename',
                      title: 'Rename Workflow Profile',
                      submitLabel: 'Rename Profile',
                      defaultName: activeProfile.name,
                      sourceProfileId: activeProfile.id,
                    })
                  }
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
                >
                  <Pencil size={16} />
                  Rename
                </button>
              </>
            ) : null}
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 font-semibold"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Editing Context
            </div>
            {activeProfile ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-lg font-black text-slate-900">{activeProfile.name}</div>
                  <div className="text-sm text-slate-600">
                    Dealer-specific workflow profile. Changes here affect only dealers assigned to this profile.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
                    {activeProfile.dealerCount} assigned dealer{activeProfile.dealerCount === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Profile slug: {activeProfile.slug}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="text-lg font-black text-slate-900">Global Default Workflow</div>
                <div className="text-sm text-slate-600">
                  Changes here apply to all dealers that are not assigned to a dealer-specific workflow profile.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Assigned Dealers
            </div>
            {activeProfile ? (
              activeProfile.dealerNames.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeProfile.dealerNames.map((dealerName) => (
                    <span
                      key={dealerName}
                      className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900"
                    >
                      {dealerName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-amber-700">
                  No dealers are currently assigned to this profile. You can assign them from Admin &gt; Dealers.
                </div>
              )
            ) : (
              <div className="mt-3 text-sm text-slate-600">
                The global workflow is used automatically whenever a dealer does not have a specific workflow profile assigned.
              </div>
            )}
          </div>
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
            <div className="flex items-center gap-2 text-slate-800">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <span className="font-semibold">
                {selectedProfileId
                  ? 'You are editing a dealer-specific workflow override. Any unset stage falls back to the global default.'
                  : 'You are editing the global default workflow used by dealers without a special profile.'}
              </span>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setDocLabelsOpen((prev) => !prev)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                    {docLabelsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                  <h2 className="text-lg font-extrabold text-slate-900">Document Labels</h2>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Edit visible names and drag to reorder. Internal document keys stay stable.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                {docOptions.length} docs
              </span>
            </button>

            {docLabelsOpen ? (
              <div className="mt-4">
                <div className="mb-4 flex flex-wrap justify-end gap-2">
                  <button
                    onClick={openDocumentManager}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  >
                    <Plus size={16} />
                    New Document
                  </button>
                  <button
                    onClick={() => void saveDocLabels()}
                    disabled={savingLabels}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-60"
                  >
                    <Save size={16} />
                    {savingLabels ? 'Saving...' : 'Save Labels'}
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                        <span>
                          Source:{' '}
                          <span className="font-semibold uppercase">{doc.source || 'default'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => updateDocVisibility(doc.value, !(doc.visibleToDealerDefault ?? true))}
                          className={[
                            'rounded-full border px-2 py-1 font-semibold',
                            doc.visibleToDealerDefault ?? true
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600',
                          ].join(' ')}
                        >
                          {doc.visibleToDealerDefault ?? true ? 'Dealer default on' : 'Dealer default off'}
                        </button>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Internal key: <span className="font-semibold">{doc.key}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
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

      {mounted && profileManager
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-black text-slate-900">{profileManager.title}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {profileManager.mode === 'create'
                    ? 'This will create a new workflow profile using the current global workflow as its starting point.'
                    : profileManager.mode === 'duplicate'
                    ? 'This will create a new profile by copying the currently selected dealer-specific workflow.'
                    : 'This only changes the visible profile name. The internal slug stays stable.'}
                </p>

                <div className="mt-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Profile Name</label>
                  <input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    placeholder="Enter profile name"
                  />
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    onClick={closeProfileManager}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void submitProfileManager()}
                    disabled={profileBusy || !profileName.trim()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                  >
                    {profileBusy ? 'Saving…' : profileManager.submitLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {mounted && documentManager
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <h2 className="text-2xl font-black text-slate-900">{documentManager.title}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  This creates a real workflow document definition that can be assigned to workflow stages and used in upload media immediately.
                </p>

                <div className="mt-5">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Document Label</label>
                  <input
                    value={documentLabel}
                    onChange={(e) => setDocumentLabel(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    placeholder="Example: Final QA Photos"
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-semibold text-slate-900">Dealer visibility default</div>
                  <p className="mt-1 text-sm text-slate-600">
                    This only sets the default for new uploads. Admin can still override visibility file by file.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDocumentVisibleToDealer((prev) => !prev)}
                    className={[
                      'mt-3 rounded-full border px-3 py-2 text-sm font-semibold',
                      documentVisibleToDealer
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-700',
                    ].join(' ')}
                  >
                    {documentVisibleToDealer ? 'Visible to dealer by default' : 'Internal only by default'}
                  </button>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    onClick={closeDocumentManager}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void submitDocumentManager()}
                    disabled={documentBusy || !documentLabel.trim()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                  >
                    {documentBusy ? 'Saving…' : documentManager.submitLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
