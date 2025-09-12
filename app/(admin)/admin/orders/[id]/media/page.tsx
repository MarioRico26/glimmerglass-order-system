// app/(admin)/admin/orders/[id]/media/page.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

type Media = {
  id: string
  type: string
  fileUrl: string
  uploadedAt: string
}

const aqua = '#00B2CA'
const deep = '#007A99'

function toApiUrl(fileUrl: string) {
  return fileUrl?.startsWith('/uploads/')
    ? '/api/uploads/' + fileUrl.replace('/uploads/', '')
    : fileUrl
}

async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) return null
    const text = await res.text()
    if (!text) return null
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export default function OrderMediaPage() {
  const params = useParams()
  const orderId = useMemo(() => {
    const raw = params?.id as string | string[] | undefined
    return Array.isArray(raw) ? raw[0] : (raw ?? '')
  }, [params])

  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState('update')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [mediaList, setMediaList] = useState<Media[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const fetchMedia = async () => {
    if (!orderId) return
    setFetchError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, { cache: 'no-store' })
      if (!res.ok) {
        setFetchError(`Failed: ${res.status}`)
        setMediaList([])
        return
      }
      const data = await safeJson<Media[] | { items: Media[] }>(res)
      const items = Array.isArray(data) ? data : (Array.isArray((data as any)?.items) ? (data as any).items : [])
      setMediaList(items)
    } catch (err) {
      console.error('Error fetching media:', err)
      setFetchError('Failed to load media.')
    }
  }

  useEffect(() => {
    fetchMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!orderId) {
      setMessage('Missing order id.')
      return
    }
    if (!file) {
      setMessage('Please select a file.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/media`, {
        method: 'POST',
        body: formData,
      })
      const payload = await safeJson<any>(res)

      if (res.ok) {
        setMessage('File uploaded successfully!')
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchMedia()
      } else {
        setMessage(payload?.message || 'Upload failed.')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setMessage('Network error during upload.')
    } finally {
      setLoading(false)
    }
  }

  const isImage = (url: string) => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url)
  const isPdf = (url: string) => /\.pdf$/i.test(url)

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto rounded-2xl border border-white bg-white/80 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,122,153,0.12)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-slate-900">Upload Media</h1>
        <div
          className="h-1 w-32 rounded-full"
          style={{ backgroundImage: `linear-gradient(90deg, ${aqua}, ${deep})` }}
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 text-sm font-semibold">File</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
              className="w-full border rounded p-2 bg-white"
            />
          </div>

          <div>
            <label className="block mb-1 text-sm font-semibold">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border rounded p-2 bg-white"
            >
              <option value="update">Update</option>
              <option value="proof">Proof</option>
              <option value="photo">Photo</option>
              <option value="note">Note</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Uploading…' : 'Upload'}
        </button>

        {message && <p className="mt-2 text-sm">{message}</p>}
      </form>

      <h2 className="text-lg font-bold mb-2">Uploaded Files</h2>
      {fetchError ? (
        <p className="text-red-600">{fetchError}</p>
      ) : mediaList.length === 0 ? (
        <p className="text-gray-600">No media uploaded yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mediaList.map((m) => {
            const url = toApiUrl(m.fileUrl)
            return (
              <div key={m.id} className="border rounded-lg p-3 bg-white shadow-sm">
                <div className="text-xs text-slate-500 mb-1">
                  {new Date(m.uploadedAt).toLocaleString()} • {m.type}
                </div>
                <div className="aspect-video bg-slate-50 border rounded flex items-center justify-center overflow-hidden">
                  {isImage(url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="media" className="object-cover w-full h-full" />
                  ) : isPdf(url) ? (
                    <div className="text-slate-500 text-sm">PDF Document</div>
                  ) : (
                    <div className="text-slate-500 text-sm">File</div>
                  )}
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-blue-600 underline text-sm"
                >
                  View / Download
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}