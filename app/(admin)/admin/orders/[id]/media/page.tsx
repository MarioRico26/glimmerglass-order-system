'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Image as ImageIcon, Trash2, UploadCloud, X } from 'lucide-react'
import { useWorkflowDocLabels } from '@/hooks/useWorkflowDocLabels'
import { labelDocType } from '@/lib/orderFlow'

type Media = {
  id: string
  type: string
  docType: string | null
  visibleToDealer?: boolean
  fileUrl: string
  uploadedAt: string
  uploadedByRole?: string | null
  uploadedByDisplayName?: string | null
  uploadedByEmail?: string | null
}

type WorkflowDocumentOption = {
  id: string
  key: string
  label: string
  sortOrder: number
  source: 'legacy' | 'custom'
  legacyDocType?: string | null
  active: boolean
  visibleToDealerDefault: boolean
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text()
    return text ? (JSON.parse(text) as T) : null
  } catch {
    return null
  }
}

function formatUploader(media: Pick<Media, 'uploadedByDisplayName' | 'uploadedByEmail'>) {
  const displayName = media.uploadedByDisplayName?.trim()
  const email = media.uploadedByEmail?.trim()
  if (displayName && email) return `${displayName} • ${email}`
  if (displayName) return displayName
  if (email) return email
  return 'Legacy upload'
}

function mediaLabel(media: Media, labelForDocType: (docType?: string | null) => string | undefined) {
  return media.docType
    ? labelForDocType(media.docType) || labelDocType(media.docType) || media.docType
    : media.type === 'photo'
      ? 'Photo'
      : 'Uncategorized'
}

async function compressImage(file: File): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${file.name}`))
    img.src = dataUrl
  })

  const maxDimension = 2200
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.82)
  })

  if (!blob) return file

  const baseName = file.name.replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

export default function OrderMediaPage() {
  const params = useParams()
  const orderId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined
    return Array.isArray(raw) ? raw[0] : raw ?? ''
  }, [params])

  const [file, setFile] = useState<File | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [docType, setDocType] = useState<string>('OTHER')
  const [photoDocType, setPhotoDocType] = useState<string>('POST_PRODUCTION_MEDIA')
  const [visibleToDealer, setVisibleToDealer] = useState(true)
  const [photoVisibleToDealer, setPhotoVisibleToDealer] = useState(true)
  const [docOptions, setDocOptions] = useState<WorkflowDocumentOption[]>([])

  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoUploadProgress, setPhotoUploadProgress] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [previewPhoto, setPreviewPhoto] = useState<Media | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const { labelForDocType } = useWorkflowDocLabels()

  const selectedDoc = useMemo(
    () => docOptions.find((item) => item.key === docType) || null,
    [docOptions, docType]
  )
  const selectedPhotoDoc = useMemo(
    () => docOptions.find((item) => item.key === photoDocType) || null,
    [docOptions, photoDocType]
  )
  const legacyDocOptions = useMemo(
    () => docOptions.filter((item) => item.source === 'legacy'),
    [docOptions]
  )
  const customDocOptions = useMemo(
    () => docOptions.filter((item) => item.source === 'custom'),
    [docOptions]
  )
  const customDocKeys = useMemo(
    () => new Set(customDocOptions.map((item) => item.key)),
    [customDocOptions]
  )
  const photoMedia = useMemo(
    () => mediaList.filter((item) => item.type === 'photo'),
    [mediaList]
  )
  const documentMedia = useMemo(
    () => mediaList.filter((item) => item.type !== 'photo'),
    [mediaList]
  )

  const fetchMedia = async () => {
    if (!orderId) return
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' })
      if (!res.ok) {
        setFetchError(`Failed to load files (${res.status})`)
        setMediaList([])
        return
      }
      const data = await safeJson<Media[] | { items: Media[] }>(res)
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: Media[] } | null)?.items)
          ? (data as { items: Media[] }).items
          : []
      setMediaList(items)
    } catch (err) {
      console.error('Error fetching media:', err)
      setFetchError('Failed to load files.')
    }
  }

  useEffect(() => {
    fetchMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/workflow-doc-labels', { cache: 'no-store' })
        const data = await safeJson<{ items?: WorkflowDocumentOption[] }>(res)
        if (!res.ok || !Array.isArray(data?.items)) return

        setDocOptions(data.items)

        const selected = data.items.find((item) => item.key === docType)
        if (selected) {
          setVisibleToDealer(selected.visibleToDealerDefault)
        } else if (data.items.length > 0) {
          setDocType(data.items[0].key)
          setVisibleToDealer(data.items[0].visibleToDealerDefault)
        }

        const defaultPhotoDoc =
          data.items.find((item) => item.key === 'POST_PRODUCTION_MEDIA') ||
          data.items.find((item) => item.key === 'PRE_SHIPPING_MEDIA') ||
          data.items[0]

        if (defaultPhotoDoc) {
          setPhotoDocType(defaultPhotoDoc.key)
          setPhotoVisibleToDealer(defaultPhotoDoc.visibleToDealerDefault)
        }
      } catch {
        // keep defaults
      }
    })()
  }, [docType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!orderId) return setMessage('Missing order id.')
    if (!file) return setMessage('Please select a file.')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentKey', docType)
    formData.append('visibleToDealer', String(visibleToDealer))

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, {
        method: 'POST',
        body: formData,
      })
      const payload = await safeJson<{ message?: string }>(res)

      if (res.ok) {
        setMessage('✅ File uploaded.')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        await fetchMedia()
      } else {
        setMessage(payload?.message || '❌ Upload failed.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setMessage('❌ Network error during upload.')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(''), 2500)
    }
  }

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!orderId) return setMessage('Missing order id.')
    if (!photoFiles.length) return setMessage('Please select at least one photo.')
    if (photoFiles.length > 20) return setMessage('Please upload at most 20 photos per batch.')

    setPhotoUploading(true)
    let successCount = 0
    const failures: string[] = []

    try {
      for (let index = 0; index < photoFiles.length; index += 1) {
        const rawFile = photoFiles[index]
        setPhotoUploadProgress(`Optimizing ${index + 1} of ${photoFiles.length}: ${rawFile.name}`)

        try {
          const optimized = await compressImage(rawFile)
          const formData = new FormData()
          formData.append('file', optimized)
          formData.append('documentKey', photoDocType)
          formData.append('visibleToDealer', String(photoVisibleToDealer))

          setPhotoUploadProgress(`Uploading ${index + 1} of ${photoFiles.length}: ${rawFile.name}`)
          const res = await fetch(`/api/admin/orders/${orderId}/media`, {
            method: 'POST',
            body: formData,
          })
          const payload = await safeJson<{ message?: string }>(res)
          if (!res.ok) {
            failures.push(`${rawFile.name}: ${payload?.message || 'upload failed'}`)
            continue
          }
          successCount += 1
        } catch (error) {
          console.error('Photo batch upload error:', error)
          failures.push(`${rawFile.name}: could not process image`)
        }
      }

      if (successCount > 0) {
        await fetchMedia()
      }

      if (successCount > 0 && failures.length === 0) {
        setMessage(`✅ Uploaded ${successCount} photo${successCount === 1 ? '' : 's'}.`)
      } else if (successCount > 0) {
        setMessage(`⚠️ Uploaded ${successCount} photo${successCount === 1 ? '' : 's'}. ${failures.length} failed.`)
      } else {
        setMessage(failures[0] ? `❌ ${failures[0]}` : '❌ Photo upload failed.')
      }

      setPhotoFiles([])
      if (photoInputRef.current) photoInputRef.current.value = ''
    } finally {
      setPhotoUploading(false)
      setPhotoUploadProgress('')
      setTimeout(() => setMessage(''), 3500)
    }
  }

  const handleDelete = async (mediaId: string) => {
    const target = mediaList.find((item) => item.id === mediaId)
    if (!target) return
    const confirmed = window.confirm(
      `Remove "${target.docType ? labelForDocType(target.docType) || labelDocType(target.docType) || target.docType : 'this file'}"? This cannot be undone.`
    )
    if (!confirmed) return

    setDeletingId(mediaId)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media?mediaId=${encodeURIComponent(mediaId)}`, {
        method: 'DELETE',
      })
      const payload = await safeJson<{ message?: string }>(res)
      if (!res.ok) {
        setMessage(payload?.message || '❌ Could not remove file.')
        return
      }
      setMediaList((current) => current.filter((item) => item.id !== mediaId))
      if (previewPhoto?.id === mediaId) setPreviewPhoto(null)
      setMessage('✅ File removed.')
    } catch (err) {
      console.error('Delete media error:', err)
      setMessage('❌ Network error while removing file.')
    } finally {
      setDeletingId(null)
      setTimeout(() => setMessage(''), 2500)
    }
  }

  return (
    <div className="w-full p-6 xl:p-8">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h1 className="text-2xl font-black text-slate-900">Order Media</h1>
          <p className="mt-1 text-sm text-slate-500">
            Order: <span className="font-mono">{orderId}</span>
          </p>
        </div>

        <div className="space-y-8 p-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Pool Photo Gallery</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Upload multiple order photos at once. Images are compressed automatically before upload.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                {photoMedia.length} photos
              </div>
            </div>

            <form onSubmit={handlePhotoUpload} className="grid gap-4">
              <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Photos</label>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Up to 20 photos per batch. Recommended for production, shipping, and warranty reference.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Photo Label</label>
                    <select
                      value={photoDocType}
                      onChange={(e) => {
                        const nextKey = e.target.value
                        setPhotoDocType(nextKey)
                        const nextOption = docOptions.find((item) => item.key === nextKey)
                        if (nextOption) setPhotoVisibleToDealer(nextOption.visibleToDealerDefault)
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {legacyDocOptions.length ? (
                        <optgroup label="Core Workflow Documents">
                          {legacyDocOptions.map((item) => (
                            <option key={item.id} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {customDocOptions.length ? (
                        <optgroup label="Custom Documents">
                          {customDocOptions.map((item) => (
                            <option key={item.id} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Visibility</label>
                      <button
                        type="button"
                        onClick={() => setPhotoVisibleToDealer((v) => !v)}
                        className={[
                          'w-full rounded-lg border px-3 py-2 text-sm font-semibold',
                          photoVisibleToDealer
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700',
                        ].join(' ')}
                      >
                        {photoVisibleToDealer ? 'Visible to dealer' : 'Internal only'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={photoUploading || !photoFiles.length}
                      className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {photoUploading ? 'Uploading photos…' : 'Upload Photos'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Photo Batch
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="text-sm text-slate-700">
                      {photoFiles.length
                        ? `${photoFiles.length} photo${photoFiles.length === 1 ? '' : 's'} selected`
                        : 'No photos selected yet.'}
                    </div>
                    {selectedPhotoDoc ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        <div>
                          Label: <span className="font-semibold text-slate-900">{selectedPhotoDoc.label}</span>
                        </div>
                        <div className="mt-1">
                          Visibility: <span className="font-semibold text-slate-900">{photoVisibleToDealer ? 'Dealer visible' : 'Internal only'}</span>
                        </div>
                      </div>
                    ) : null}
                    {photoUploadProgress ? (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                        {photoUploadProgress}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Images are resized and compressed before upload so operations can send batches without bloating storage.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {photoFiles.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <UploadCloud size={16} />
                    Selected Photos
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {photoFiles.map((item) => (
                      <div key={`${item.name}-${item.lastModified}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <div className="truncate font-semibold text-slate-900">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{(item.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </form>

            <div className="mt-6">
              {photoMedia.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  No order photos uploaded yet.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {photoMedia.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => setPreviewPhoto(photo)}
                        className="block w-full bg-slate-100"
                      >
                        <img
                          src={photo.fileUrl}
                          alt={mediaLabel(photo, labelForDocType)}
                          className="h-52 w-full object-cover"
                        />
                      </button>
                      <div className="space-y-2 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {mediaLabel(photo, labelForDocType)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {photo.visibleToDealer ? 'Dealer' : 'Internal'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Uploaded by: {formatUploader(photo)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(photo.uploadedAt).toLocaleString()}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <a
                            href={photo.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-sky-700 hover:underline"
                          >
                            Open
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDelete(photo.id)}
                            disabled={deletingId === photo.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={14} />
                            {deletingId === photo.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-lg font-black text-slate-900">Workflow Documents</h2>
              <p className="mt-1 text-sm text-slate-500">Keep PDFs, proofs, and operational documents separate from the photo gallery.</p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr] items-start">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-start">
                  <div className="lg:col-span-2">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">File</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      required
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="lg:col-span-1">
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Document Type</label>
                    <select
                      value={docType}
                      onChange={(e) => {
                        const nextKey = e.target.value
                        setDocType(nextKey)
                        const nextOption = docOptions.find((item) => item.key === nextKey)
                        if (nextOption) setVisibleToDealer(nextOption.visibleToDealerDefault)
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {legacyDocOptions.length ? (
                        <optgroup label="Core Workflow Documents">
                          {legacyDocOptions.map((item) => (
                            <option key={item.id} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {customDocOptions.length ? (
                        <optgroup label="Custom Documents">
                          {customDocOptions.map((item) => (
                            <option key={item.id} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Used later for required documents per status.</p>
                  </div>

                  <div className="lg:col-span-1 flex flex-col gap-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">Visibility</label>
                      <button
                        type="button"
                        onClick={() => setVisibleToDealer((v) => !v)}
                        className={[
                          'w-full rounded-lg border px-3 py-2 text-sm font-semibold',
                          visibleToDealer
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-slate-50 text-slate-700',
                        ].join(' ')}
                      >
                        {visibleToDealer ? 'Visible to dealer' : 'Internal only'}
                      </button>
                      <p className="mt-1 text-xs text-slate-500">
                        {visibleToDealer ? 'Dealer will see this file.' : 'Hidden from dealer.'}
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-800 disabled:opacity-60"
                    >
                      {loading ? 'Uploading…' : 'Upload Document'}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Selected Document
                  </div>
                  {selectedDoc ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-base font-black text-slate-900">{selectedDoc.label}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span
                            className={[
                              'inline-flex rounded-full border px-3 py-1 text-xs font-semibold',
                              selectedDoc.source === 'custom'
                                ? 'border-violet-200 bg-violet-50 text-violet-800'
                                : 'border-sky-200 bg-sky-50 text-sky-800',
                            ].join(' ')}
                          >
                            {selectedDoc.source === 'custom' ? 'Custom document' : 'Core workflow document'}
                          </span>
                          <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            Default: {selectedDoc.visibleToDealerDefault ? 'Dealer visible' : 'Internal only'}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                        <div>
                          Internal key: <span className="font-semibold text-slate-900">{selectedDoc.key}</span>
                        </div>
                        {selectedDoc.legacyDocType ? (
                          <div className="mt-1">
                            Legacy type: <span className="font-semibold text-slate-900">{selectedDoc.legacyDocType}</span>
                          </div>
                        ) : null}
                      </div>

                      <p className="text-xs text-slate-500">
                        This selection controls workflow validation and file labeling. Custom documents behave like first-class workflow documents.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-slate-600">
                      Select a document type to review its behavior before upload.
                    </div>
                  )}
                </div>
              </div>

              {message ? <div className="text-sm font-medium text-slate-700">{message}</div> : null}
            </form>

            <div className="mt-8">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Uploaded Documents</h2>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {documentMedia.length} docs
                  </span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                    {legacyDocOptions.length} core docs
                  </span>
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
                    {customDocOptions.length} custom docs
                  </span>
                </div>
              </div>

              {fetchError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {fetchError}
                </div>
              ) : documentMedia.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
                  No documents uploaded yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {documentMedia.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{mediaLabel(m, labelForDocType)}</span>
                          <span
                            className={[
                              'rounded-full border px-2 py-0.5 text-xs',
                              customDocKeys.has(m.docType || '')
                                ? 'border-violet-200 bg-violet-50 text-violet-700'
                                : 'border-sky-200 bg-sky-50 text-sky-700',
                            ].join(' ')}
                          >
                            {customDocKeys.has(m.docType || '') ? 'Custom' : 'Core'}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                            {m.visibleToDealer ? 'Dealer' : 'Internal'}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
                            {m.type}
                          </span>
                        </div>

                        <a
                          href={m.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block max-w-[52ch] truncate text-sm text-sky-700 hover:underline"
                        >
                          View / Download
                        </a>

                        <div className="mt-1 text-xs text-slate-500">
                          Uploaded by: {formatUploader(m)}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <div className="text-xs text-slate-500">{new Date(m.uploadedAt).toLocaleString()}</div>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          disabled={deletingId === m.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          {deletingId === m.id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {previewPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setPreviewPhoto(null)}>
          <div
            className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.45)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-black text-slate-900">{mediaLabel(previewPhoto, labelForDocType)}</div>
                <div className="mt-1 text-sm text-slate-500">
                  Uploaded by {formatUploader(previewPhoto)} • {new Date(previewPhoto.uploadedAt).toLocaleString()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                aria-label="Close photo preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex h-[72vh] items-center justify-center overflow-auto rounded-xl bg-slate-100 p-2">
              <img
                src={previewPhoto.fileUrl}
                alt={mediaLabel(previewPhoto, labelForDocType)}
                className="h-auto max-h-full w-auto max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
