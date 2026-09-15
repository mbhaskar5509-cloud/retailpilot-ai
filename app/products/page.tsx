'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string
  category: string | null
  unit: string | null
  purchase_price: number
  selling_price: number
  reorder_level: number
  is_active: boolean
}

export default function ProductsPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('Pieces')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [sellingPrice, setSellingPrice] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile?.tenant_id) {
      setMessage('Business profile not found.')
      setLoading(false)
      return
    }

    setTenantId(profile.tenant_id)

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setProducts(data ?? [])
    }

    setLoading(false)
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId) {
      setMessage('Tenant not found.')
      return
    }

    setMessage('Adding product...')

    const { error } = await supabase.from('products').insert({
      tenant_id: tenantId,
      name,
      sku,
      category: category || null,
      unit,
      purchase_price: Number(purchasePrice) || 0,
      selling_price: Number(sellingPrice) || 0,
      reorder_level: Number(reorderLevel) || 0,
      is_active: true,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Product added successfully!')

    setName('')
    setSku('')
    setCategory('')
    setUnit('Pieces')
    setPurchasePrice('')
    setSellingPrice('')
    setReorderLevel('')

    await loadProducts()
  }

  async function deactivateProduct(id: string) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Product deactivated.')
    await loadProducts()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Products
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your supermarket products, prices and stock thresholds.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        {/* Add Product */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-900">
              Add New Product
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter product details below.
            </p>
          </div>

          <form onSubmit={addProduct}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Product Name
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Milk 1L"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  SKU
                </label>

                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="MILK001"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Category
                </label>

                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Dairy"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Unit
                </label>

                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option>Pieces</option>
                  <option>Kg</option>
                  <option>Grams</option>
                  <option>Litres</option>
                  <option>Packets</option>
                  <option>Boxes</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Purchase Price
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  placeholder="25"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Selling Price
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="30"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Reorder Level
                </label>

                <input
                  type="number"
                  min="0"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  placeholder="10"
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

            </div>

            <button
              type="submit"
              className="mt-5 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              + Add Product
            </button>
          </form>
        </section>

        {/* Product List */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Product List
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {products.length} product{products.length !== 1 ? 's' : ''} found
              </p>
            </div>

            <button
              onClick={loadProducts}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-lg font-semibold text-slate-800">
                No products yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Add your first product using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Product
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      SKU
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Category
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Unit
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Purchase
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Selling
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reorder
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="whitespace-nowrap px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <div className="min-w-[160px]">
                          <p className="font-semibold text-slate-900">
                            {product.name}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {product.sku}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {product.category || '-'}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {product.unit || '-'}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-700">
                        ₹{Number(product.purchase_price).toFixed(2)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-900">
                        ₹{Number(product.selling_price).toFixed(2)}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {product.reorder_level}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {product.is_active && (
                          <button
                            onClick={() => deactivateProduct(product.id)}
                            className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}