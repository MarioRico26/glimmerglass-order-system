'use client'
import { useEffect, useState } from 'react'

export default function ColorsPage() {
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState({ name:'', swatchUrl:'' })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/catalog/colors')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/catalog/colors', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) {
      alert(data.message || 'Error saving color')
      return
    }
    setForm({ name:'', swatchUrl:'' })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this color?')) return
    await fetch('/api/admin/catalog/colors', {
      method:'DELETE',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">🎨 Manage Colors</h1>

      <form onSubmit={save} className="flex flex-wrap gap-3 mb-8 bg-white p-4 rounded-lg shadow">
        <input
          className="border border-gray-300 rounded p-2 flex-1"
          placeholder="Name"
          value={form.name}
          onChange={e=>setForm(f=>({...f, name:e.target.value}))}
          required
        />
        <input
          className="border border-gray-300 rounded p-2 flex-1"
          placeholder="Swatch URL (optional)"
          value={form.swatchUrl}
          onChange={e=>setForm(f=>({...f, swatchUrl:e.target.value}))}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
        >
          Add Color
        </button>
      </form>

      {loading ? (
        <div className="text-center py-6 text-gray-500">Loading colors...</div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 text-left border">Name</th>
                <th className="p-3 text-left border">Swatch</th>
                <th className="p-3 text-left border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-gray-500">
                    No colors found.
                  </td>
                </tr>
              ) : (
                items.map((c:any, idx:number)=>(
                  <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border p-3 font-medium">{c.name}</td>
                    <td className="border p-3">
                      {c.swatchUrl ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded shadow" style={{ backgroundColor: `url(${c.swatchUrl})` }} />
                          <img alt={c.name} src={c.swatchUrl} className="h-10 border rounded" />
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="border p-3">
                      <button
                        onClick={()=>remove(c.id)}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded shadow"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}