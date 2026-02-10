'use client'

import { useEffect, useMemo, useState } from 'react'

type Category = {
  id: string
  name: string
  sortOrder: number
  active: boolean
  _count?: { items: number }
}

type Item = {
  id: string
  sku: string
  name: string
  unit: string
  minStock: number
  sortOrder: number
  active: boolean
  categoryId: string | null
  category?: { id: string; name: string } | null
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export default function InventoryMasterPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingCategoryId, setSavingCategoryId] = useState<string | null>(null)
  const [savingItemId, setSavingItemId] = useState<string | null>(null)

  const [categoryName, setCategoryName] = useState('')
  const [categorySortOrder, setCategorySortOrder] = useState(9999)
  const [itemSku, setItemSku] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemUnit, setItemUnit] = useState('ea')
  const [itemMinStock, setItemMinStock] = useState(0)
  const [itemSortOrder, setItemSortOrder] = useState(9999)
  const [itemCategoryId, setItemCategoryId] = useState('')
  const [itemSearch, setItemSearch] = useState('')

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [catRes, itemRes] = await Promise.all([
        fetch('/api/admin/inventory/categories', { cache: 'no-store' }),
        fetch('/api/admin/inventory/items?take=500', { cache: 'no-store' }),
      ])

      const catJson = await catRes.json().catch(() => null)
      const itemJson = await itemRes.json().catch(() => null)

      if (!catRes.ok) {
        throw new Error(catJson?.message || 'Failed to load categories')
      }
      if (!itemRes.ok) {
        throw new Error(itemJson?.message || 'Failed to load items')
      }

      setCategories(Array.isArray(catJson?.items) ? catJson.items : [])
      setItems(Array.isArray(itemJson?.items) ? itemJson.items : [])
    } catch (e: unknown) {
      setError(toErrorMessage(e, 'Failed to load inventory master data'))
      setCategories([])
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      return (
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.category?.name || '').toLowerCase().includes(q)
      )
    })
  }, [items, itemSearch])

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: categoryName.trim(),
          sortOrder: Number(categorySortOrder),
          active: true,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to create category')

      setCategoryName('')
      setCategorySortOrder(9999)
      await loadAll()
    } catch (e: unknown) {
      setError(toErrorMessage(e, 'Failed to create category'))
    }
  }

  const saveCategory = async (category: Category) => {
    setError('')
    setSavingCategoryId(category.id)
    try {
      const res = await fetch(`/api/admin/inventory/categories/${category.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: category.name,
          sortOrder: Number(category.sortOrder),
          active: category.active,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to save category')
      await loadAll()
    } catch (e: unknown) {
      setError(toErrorMessage(e, 'Failed to save category'))
    } finally {
      setSavingCategoryId(null)
    }
  }

  const createItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/admin/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: itemSku.trim(),
          name: itemName.trim(),
          unit: itemUnit.trim() || 'ea',
          minStock: Number(itemMinStock),
          sortOrder: Number(itemSortOrder),
          categoryId: itemCategoryId || null,
          active: true,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to create item')

      setItemSku('')
      setItemName('')
      setItemUnit('ea')
      setItemMinStock(0)
      setItemSortOrder(9999)
      setItemCategoryId('')
      await loadAll()
    } catch (e: unknown) {
      setError(toErrorMessage(e, 'Failed to create item'))
    }
  }

  const saveItem = async (item: Item) => {
    setError('')
    setSavingItemId(item.id)
    try {
      const res = await fetch(`/api/admin/inventory/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          minStock: Number(item.minStock),
          sortOrder: Number(item.sortOrder),
          categoryId: item.categoryId,
          active: item.active,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message || 'Failed to save item')
      await loadAll()
    } catch (e: unknown) {
      setError(toErrorMessage(e, 'Failed to save item'))
    } finally {
      setSavingItemId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Inventory Setup</h1>
        <p className="text-slate-600">
          Manage custom categories and items (raw materials, supplies, sandpaper, etc).
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900 mb-3">Add Category</div>
        <form onSubmit={createCategory} className="grid gap-3 grid-cols-1 md:grid-cols-4">
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm md:col-span-2"
            placeholder="Category name (ex: Supplies)"
            required
          />
          <input
            type="number"
            value={categorySortOrder}
            onChange={(e) => setCategorySortOrder(Number(e.target.value))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Sort order"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Add Category
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900 mb-3">Categories</div>
        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No categories yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3 text-right">Sort</th>
                  <th className="py-2 pr-3 text-right">Items</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-t">
                    <td className="py-3 pr-3">
                      <input
                        value={cat.name}
                        onChange={(e) =>
                          setCategories((prev) =>
                            prev.map((row) =>
                              row.id === cat.id ? { ...row, name: e.target.value } : row
                            )
                          )
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2"
                      />
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <input
                        type="number"
                        value={cat.sortOrder}
                        onChange={(e) =>
                          setCategories((prev) =>
                            prev.map((row) =>
                              row.id === cat.id ? { ...row, sortOrder: Number(e.target.value) } : row
                            )
                          )
                        }
                        className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right"
                      />
                    </td>
                    <td className="py-3 pr-3 text-right">{cat._count?.items ?? 0}</td>
                    <td className="py-3 pr-3">
                      <button
                        onClick={() =>
                          setCategories((prev) =>
                            prev.map((row) =>
                              row.id === cat.id ? { ...row, active: !row.active } : row
                            )
                          )
                        }
                        className={`h-8 rounded-lg border px-3 text-xs ${cat.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                      >
                        {cat.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <button
                        onClick={() => void saveCategory(cat)}
                        disabled={savingCategoryId === cat.id}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                      >
                        {savingCategoryId === cat.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900 mb-3">Add Item</div>
        <form onSubmit={createItem} className="grid gap-3 grid-cols-1 md:grid-cols-6">
          <input
            value={itemSku}
            onChange={(e) => setItemSku(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="SKU"
            required
          />
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm md:col-span-2"
            placeholder="Item name"
            required
          />
          <select
            value={itemCategoryId}
            onChange={(e) => setItemCategoryId(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <input
            value={itemUnit}
            onChange={(e) => setItemUnit(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Unit"
          />
          <input
            type="number"
            value={itemMinStock}
            onChange={(e) => setItemMinStock(Number(e.target.value))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Min stock"
          />
          <input
            type="number"
            value={itemSortOrder}
            onChange={(e) => setItemSortOrder(Number(e.target.value))}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Sort"
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white md:col-span-2"
          >
            Add Item
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Items</div>
          <input
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            className="h-10 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 text-sm"
            placeholder="Search SKU / item / category"
          />
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading…</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-center text-slate-500">No items found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3 text-right">Min</th>
                  <th className="py-2 pr-3 text-right">Sort</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-3 pr-3">
                      <input
                        value={item.sku}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, sku: e.target.value } : row
                            )
                          )
                        }
                        className="h-9 w-36 rounded-lg border border-slate-200 bg-white px-2"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        value={item.name}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, name: e.target.value } : row
                            )
                          )
                        }
                        className="h-9 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white px-2"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={item.categoryId || ''}
                        onChange={(e) => {
                          const nextCategoryId = e.target.value || null
                          const nextCategory = categories.find((c) => c.id === nextCategoryId)
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id
                                ? {
                                    ...row,
                                    categoryId: nextCategoryId,
                                    category: nextCategory
                                      ? { id: nextCategory.id, name: nextCategory.name }
                                      : null,
                                  }
                                : row
                            )
                          )
                        }}
                        className="h-9 w-44 rounded-lg border border-slate-200 bg-white px-2"
                      >
                        <option value="">No category</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        value={item.unit}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, unit: e.target.value } : row
                            )
                          )
                        }
                        className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2"
                      />
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <input
                        type="number"
                        value={item.minStock}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, minStock: Number(e.target.value) } : row
                            )
                          )
                        }
                        className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right"
                      />
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <input
                        type="number"
                        value={item.sortOrder}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, sortOrder: Number(e.target.value) } : row
                            )
                          )
                        }
                        className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-right"
                      />
                    </td>
                    <td className="py-3 pr-3">
                      <button
                        onClick={() =>
                          setItems((prev) =>
                            prev.map((row) =>
                              row.id === item.id ? { ...row, active: !row.active } : row
                            )
                          )
                        }
                        className={`h-8 rounded-lg border px-3 text-xs ${item.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                      >
                        {item.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <button
                        onClick={() => void saveItem(item)}
                        disabled={savingItemId === item.id}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs"
                      >
                        {savingItemId === item.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
