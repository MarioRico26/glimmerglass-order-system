'use client'
import { useEffect, useState } from 'react'

export default function PoolModelsPage() {
  const [items, setItems] = useState<any[]>([])
  const [form, setForm] = useState({ name:'', lengthFt: null as any, widthFt: null as any, depthFt: null as any })
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/catalog/pool-models')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }
  useEffect(()=>{ load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/admin/catalog/pool-models', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({name:'', lengthFt:null, widthFt:null, depthFt:null})
      load()
    } else {
      alert('Error saving pool model')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pool model?')) return
    await fetch('/api/admin/catalog/pool-models', {
      method:'DELETE',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id }),
    })
    load()
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">🏊‍♂️ Manage Pool Models</h1>

      <form onSubmit={save} className="flex flex-wrap gap-3 mb-8 bg-white p-4 rounded-lg shadow">
        <input className="border border-gray-300 rounded p-2 flex-1" placeholder="Name"
          value={form.name}
          onChange={e=>setForm(f=>({...f, name:e.target.value}))}
          required
        />
        <input className="border border-gray-300 rounded p-2 w-28" placeholder="Length (ft)" type="number"
          value={form.lengthFt ?? ''}
          onChange={e=>setForm(f=>({...f, lengthFt: e.target.value ? Number(e.target.value) : null}))}
        />
        <input className="border border-gray-300 rounded p-2 w-28" placeholder="Width (ft)" type="number"
          value={form.widthFt ?? ''}
          onChange={e=>setForm(f=>({...f, widthFt: e.target.value ? Number(e.target.value) : null}))}
        />
        <input className="border border-gray-300 rounded p-2 w-28" placeholder="Depth (ft)" type="number"
          value={form.depthFt ?? ''}
          onChange={e=>setForm(f=>({...f, depthFt: e.target.value ? Number(e.target.value) : null}))}
        />
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow">
          Add Model
        </button>
      </form>

      {loading ? (
        <div className="text-center py-6 text-gray-500">Loading pool models...</div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Name</th>
                <th className="p-3 border text-center">Length (ft)</th>
                <th className="p-3 border text-center">Width (ft)</th>
                <th className="p-3 border text-center">Depth (ft)</th>
                <th className="p-3 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">
                    No pool models found.
                  </td>
                </tr>
              ) : (
                items.map((m:any, idx:number)=>(
                  <tr key={m.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border p-3 font-medium">{m.name}</td>
                    <td className="border p-3 text-center">{m.lengthFt ?? '-'}</td>
                    <td className="border p-3 text-center">{m.widthFt ?? '-'}</td>
                    <td className="border p-3 text-center">{m.depthFt ?? '-'}</td>
                    <td className="border p-3 text-center">
                      <button
                        onClick={()=>remove(m.id)}
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