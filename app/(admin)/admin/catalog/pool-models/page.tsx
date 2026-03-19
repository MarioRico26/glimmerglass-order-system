'use client'

import { useEffect, useMemo, useState } from 'react'

type Factory = {
  id: string
  name: string
  city?: string | null
  state?: string | null
}

type PoolModel = {
  id: string
  name: string
  lengthFt: number | null
  widthFt: number | null
  depthFt: number | null
  imageUrl?: string | null
  blueprintUrl?: string | null
  hasIntegratedSpa?: boolean
  defaultFactoryLocationId?: string | null
  defaultFactoryLocation?: { id: string; name: string } | null
  maxSkimmers?: number | null
  maxReturns?: number | null
  maxMainDrains?: number | null
}

type ModelDraft = {
  name: string
  lengthFt: string
  widthFt: string
  depthFt: string
  defaultFactoryLocationId: string
  maxSkimmers: string
  maxReturns: string
  maxMainDrains: string
  hasIntegratedSpa: boolean
}

type CreateForm = {
  name: string
  lengthFt: string
  widthFt: string
  depthFt: string
  defaultFactoryLocationId: string
  maxSkimmers: string
  maxReturns: string
  maxMainDrains: string
  hasIntegratedSpa: boolean
}

const EMPTY_FORM: CreateForm = {
  name: '',
  lengthFt: '',
  widthFt: '',
  depthFt: '',
  defaultFactoryLocationId: '',
  maxSkimmers: '',
  maxReturns: '',
  maxMainDrains: '',
  hasIntegratedSpa: false,
}

function toDraft(model: PoolModel): ModelDraft {
  return {
    name: model.name ?? '',
    lengthFt: model.lengthFt == null ? '' : String(model.lengthFt),
    widthFt: model.widthFt == null ? '' : String(model.widthFt),
    depthFt: model.depthFt == null ? '' : String(model.depthFt),
    defaultFactoryLocationId: model.defaultFactoryLocationId ?? '',
    maxSkimmers: model.maxSkimmers == null ? '' : String(model.maxSkimmers),
    maxReturns: model.maxReturns == null ? '' : String(model.maxReturns),
    maxMainDrains: model.maxMainDrains == null ? '' : String(model.maxMainDrains),
    hasIntegratedSpa: !!model.hasIntegratedSpa,
  }
}

function parseDecimal(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function parseDecimalForPatch(raw: string): number | undefined {
  const value = raw.trim()
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return parsed
}

function parseIntOrNull(raw: string): number | null {
  const value = raw.trim()
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null
  return parsed
}

export default function PoolModelsPage() {
  const [items, setItems] = useState<PoolModel[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [drafts, setDrafts] = useState<Record<string, ModelDraft>>({})
  const [search, setSearch] = useState('')

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)

      const [modelsRes, factoriesRes] = await Promise.all([
        fetch('/api/admin/catalog/pool-models', { cache: 'no-store' }),
        fetch('/api/catalog/factories', { cache: 'no-store' }),
      ])

      const [modelsJson, factoriesJson] = await Promise.all([
        modelsRes.json().catch(() => null),
        factoriesRes.json().catch(() => null),
      ])

      if (!modelsRes.ok) {
        throw new Error(modelsJson?.message || 'Failed to load pool models')
      }
      if (!factoriesRes.ok) {
        throw new Error(factoriesJson?.message || 'Failed to load factories')
      }

      const nextItems: PoolModel[] = Array.isArray(modelsJson?.items) ? modelsJson.items : []
      const nextFactories: Factory[] = Array.isArray(factoriesJson?.items) ? factoriesJson.items : []

      setItems(nextItems)
      setFactories(nextFactories)
      setDrafts(
        nextItems.reduce<Record<string, ModelDraft>>((acc, item) => {
          acc[item.id] = toDraft(item)
          return acc
        }, {})
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load pool models')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((m) => {
      const factoryName = m.defaultFactoryLocation?.name || ''
      return (
        m.name.toLowerCase().includes(q) ||
        factoryName.toLowerCase().includes(q)
      )
    })
  }, [items, search])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        name: form.name.trim(),
        lengthFt: parseDecimal(form.lengthFt),
        widthFt: parseDecimal(form.widthFt),
        depthFt: parseDecimal(form.depthFt),
        defaultFactoryLocationId: form.defaultFactoryLocationId || null,
        maxSkimmers: parseIntOrNull(form.maxSkimmers),
        maxReturns: parseIntOrNull(form.maxReturns),
        maxMainDrains: parseIntOrNull(form.maxMainDrains),
        hasIntegratedSpa: form.hasIntegratedSpa,
      }

      if (!payload.name) throw new Error('Model name is required')

      const res = await fetch('/api/admin/catalog/pool-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to create pool model')

      setForm(EMPTY_FORM)
      setMessage('Pool model created.')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create pool model')
    } finally {
      setCreating(false)
    }
  }

  const setDraftField = (id: string, field: keyof ModelDraft, value: string) => {
    const source = items.find((m) => m.id === id)
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ||
          (source
            ? toDraft(source)
            : {
                name: '',
                lengthFt: '',
                widthFt: '',
                depthFt: '',
                defaultFactoryLocationId: '',
                maxSkimmers: '',
                maxReturns: '',
                maxMainDrains: '',
                hasIntegratedSpa: false,
              })),
        [field]: value,
      },
    }))
  }

  const onSaveRow = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return

    setSavingId(id)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        id,
        name: draft.name.trim(),
        lengthFt: parseDecimalForPatch(draft.lengthFt),
        widthFt: parseDecimalForPatch(draft.widthFt),
        depthFt: parseDecimalForPatch(draft.depthFt),
        defaultFactoryLocationId: draft.defaultFactoryLocationId || null,
        maxSkimmers: parseIntOrNull(draft.maxSkimmers),
        maxReturns: parseIntOrNull(draft.maxReturns),
        maxMainDrains: parseIntOrNull(draft.maxMainDrains),
        hasIntegratedSpa: draft.hasIntegratedSpa,
      }

      if (!payload.name) throw new Error('Model name is required')

      const res = await fetch('/api/admin/catalog/pool-models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to update pool model')

      setMessage('Pool model updated.')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update pool model')
    } finally {
      setSavingId(null)
    }
  }

  const onDelete = async (id: string) => {
    const ok = window.confirm('Delete this pool model? This cannot be undone.')
    if (!ok) return

    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/catalog/pool-models', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to delete pool model')
      setMessage('Pool model deleted.')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete pool model')
    }
  }

  const uploadMedia = async (id: string, type: 'image' | 'blueprint', file: File) => {
    const key = `${id}:${type}`
    setUploading((prev) => ({ ...prev, [key]: true }))
    setError(null)
    setMessage(null)
    try {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('file', file)

      const res = await fetch(`/api/admin/catalog/pool-models/${id}/media`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Upload failed')

      setMessage(type === 'image' ? 'Model image uploaded.' : 'Dig sheet uploaded.')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white bg-white/70 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)] p-6">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900">Pool Catalog</h1>
        <p className="text-slate-600 mt-1">
          Create and maintain pool models, factory defaults, marker limits, and media.
        </p>
        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={onCreate}
        className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_56px_rgba(15,23,42,0.08)] p-5 space-y-4"
      >
        <div className="text-lg font-extrabold text-slate-900">Add New Model</div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            placeholder="Model name"
            required
          />
          <input
            value={form.lengthFt}
            onChange={(e) => setForm((prev) => ({ ...prev, lengthFt: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            type="number"
            min={0}
            step="0.1"
            placeholder="Length (ft)"
          />
          <input
            value={form.widthFt}
            onChange={(e) => setForm((prev) => ({ ...prev, widthFt: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            type="number"
            min={0}
            step="0.1"
            placeholder="Width (ft)"
          />
          <input
            value={form.depthFt}
            onChange={(e) => setForm((prev) => ({ ...prev, depthFt: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            type="number"
            min={0}
            step="0.1"
            placeholder="Depth (ft)"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={form.defaultFactoryLocationId}
            onChange={(e) => setForm((prev) => ({ ...prev, defaultFactoryLocationId: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Default factory (optional)</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <input
            value={form.maxSkimmers}
            onChange={(e) => setForm((prev) => ({ ...prev, maxSkimmers: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            type="number"
            min={0}
            step={1}
            placeholder="Max skimmers"
          />
          <input
            value={form.maxReturns}
            onChange={(e) => setForm((prev) => ({ ...prev, maxReturns: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            type="number"
            min={0}
            step={1}
            placeholder="Max returns"
          />
          <input
            value={form.maxMainDrains}
            onChange={(e) => setForm((prev) => ({ ...prev, maxMainDrains: e.target.value }))}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            type="number"
            min={0}
            step={1}
            placeholder="Max main drains"
          />
        </div>

        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.hasIntegratedSpa}
            onChange={(e) => setForm((prev) => ({ ...prev, hasIntegratedSpa: e.target.checked }))}
          />
          Model includes integrated spa
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creating}
            className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create model'}
          </button>
        </div>
      </form>

      <section className="rounded-3xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_20px_56px_rgba(15,23,42,0.08)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-extrabold text-slate-900">Manage Existing Models</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full md:w-80 rounded-xl border border-slate-200 bg-white px-3 text-sm"
            placeholder="Search by model or factory"
          />
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500">Loading pool models…</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-slate-500">No pool models found.</div>
        ) : (
          <div className="mt-5 space-y-5">
            {filtered.map((m) => {
              const draft = drafts[m.id] ?? toDraft(m)
              return (
                <article
                  key={m.id}
                  className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pool Model</div>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraftField(m.id, 'name', e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-900"
                      />
                      <div className="mt-2 text-[11px] text-slate-500 break-all">ID: {m.id}</div>
                    </div>
                    <div className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {draft.hasIntegratedSpa ? 'Integrated spa' : 'Pool only'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Media</div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="mb-2 text-xs font-semibold text-slate-600">Model Image</div>
                          <div className="h-44 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                            {m.imageUrl ? (
                              <img
                                src={m.imageUrl}
                                alt={m.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
                            )}
                          </div>
                          <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            {uploading[`${m.id}:image`] ? 'Uploading…' : 'Upload image'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0]
                                if (file) void uploadMedia(m.id, 'image', file)
                                e.currentTarget.value = ''
                              }}
                            />
                          </label>
                        </div>
                        <div>
                          <div className="mb-2 text-xs font-semibold text-slate-600">Dig Sheet</div>
                          <div className="flex h-24 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs">
                            {m.blueprintUrl ? (
                              <a
                                href={m.blueprintUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-sky-700 underline"
                              >
                                View file
                              </a>
                            ) : (
                              <span className="text-slate-400">No dig sheet</span>
                            )}
                          </div>
                          <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            {uploading[`${m.id}:blueprint`] ? 'Uploading…' : 'Upload dig sheet'}
                            <input
                              type="file"
                              accept="application/pdf,image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0]
                                if (file) void uploadMedia(m.id, 'blueprint', file)
                                e.currentTarget.value = ''
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </section>

                    <div className="space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dimensions (ft)</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Length</span>
                          <input
                            value={draft.lengthFt}
                            onChange={(e) => setDraftField(m.id, 'lengthFt', e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-center"
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder="Length"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Width</span>
                          <input
                            value={draft.widthFt}
                            onChange={(e) => setDraftField(m.id, 'widthFt', e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-center"
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder="Width"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Depth</span>
                          <input
                            value={draft.depthFt}
                            onChange={(e) => setDraftField(m.id, 'depthFt', e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-center"
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder="Depth"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Factory & Configuration</div>
                      <select
                        value={draft.defaultFactoryLocationId}
                        onChange={(e) => setDraftField(m.id, 'defaultFactoryLocationId', e.target.value)}
                        className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3"
                      >
                        <option value="">No default factory</option>
                        {factories.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <label className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={draft.hasIntegratedSpa}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [m.id]: {
                                ...draft,
                                hasIntegratedSpa: e.target.checked,
                              },
                            }))
                          }
                        />
                        Model includes integrated spa
                      </label>
                    </section>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Marker Limits</div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Skimmers</span>
                          <input
                            value={draft.maxSkimmers}
                            onChange={(e) => setDraftField(m.id, 'maxSkimmers', e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-center"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Skimmer"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Returns</span>
                          <input
                            value={draft.maxReturns}
                            onChange={(e) => setDraftField(m.id, 'maxReturns', e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-center"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Return"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Main Drains</span>
                          <input
                            value={draft.maxMainDrains}
                            onChange={(e) => setDraftField(m.id, 'maxMainDrains', e.target.value)}
                            className="h-10 w-full rounded-lg border border-slate-200 px-2 text-center"
                            type="number"
                            min={0}
                            step={1}
                            placeholder="Main drain"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operational Summary</div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Default Factory</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{m.defaultFactoryLocation?.name || 'Not assigned'}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Configuration</div>
                          <div className="mt-1 text-sm font-semibold text-slate-900">{draft.hasIntegratedSpa ? 'Integrated spa' : 'Pool only'}</div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => void onDelete(m.id)}
                      className="inline-flex h-10 items-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => void onSaveRow(m.id)}
                      disabled={savingId === m.id}
                      className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingId === m.id ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
