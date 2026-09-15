"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Supplier = {
  id: string
  name: string
}

type Store = {
  id: string
  name: string
}

type Product = {
  id: string
  name: string
  sku: string
  purchase_price: number
}

type Purchase = {
  id: string
  invoice_number: string | null
  purchase_date: string
  total_amount: number
  payment_status: string
  notes: string | null
  supplier_id: string | null
  store_id: string | null
  supplier?: { name: string } | null
  store?: { name: string } | null
}

type PurchaseItem = {
  product_id: string
  quantity: number
  unit_cost: number
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [supplierId, setSupplierId] = useState("")
  const [storeId, setStoreId] = useState("")
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [paymentStatus, setPaymentStatus] = useState("pending")
  const [notes, setNotes] = useState("")

  const [items, setItems] = useState<PurchaseItem[]>([
    {
      product_id: "",
      quantity: 1,
      unit_cost: 0,
    },
  ])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    loadPurchases()
  }, [])

  async function loadPurchases() {
    try {
      setLoading(true)
      setError("")

      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Please login first.")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.tenant_id) {
        setError("Business profile not found.")
        return
      }

      const tenantId = profile.tenant_id

      const [purchaseResult, supplierResult, storeResult, productResult] =
        await Promise.all([
          supabase
            .from("purchases")
            .select(
              `
              id,
              invoice_number,
              purchase_date,
              total_amount,
              payment_status,
              notes,
              supplier_id,
              store_id,
              suppliers(name),
              stores(name)
            `
            )
            .eq("tenant_id", tenantId)
            .order("purchase_date", { ascending: false }),

          supabase
            .from("suppliers")
            .select("id,name")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("stores")
            .select("id,name")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("products")
            .select("id,name,sku,purchase_price")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("name"),
        ])

      if (purchaseResult.error) throw purchaseResult.error
      if (supplierResult.error) throw supplierResult.error
      if (storeResult.error) throw storeResult.error
      if (productResult.error) throw productResult.error

      const formattedPurchases = (purchaseResult.data || []).map(
        (purchase: any) => ({
          ...purchase,
          supplier: Array.isArray(purchase.suppliers)
            ? purchase.suppliers[0] || null
            : purchase.suppliers || null,
          store: Array.isArray(purchase.stores)
            ? purchase.stores[0] || null
            : purchase.stores || null,
        })
      )

      setPurchases(formattedPurchases)
      setSuppliers(supplierResult.data || [])
      setStores(storeResult.data || [])
      setProducts(productResult.data || [])
    } catch (err) {
      console.error(err)
      setError("Unable to load purchases.")
    } finally {
      setLoading(false)
    }
  }

  function updateItem(
    index: number,
    field: keyof PurchaseItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item

        if (field === "product_id") {
          const selectedProduct = products.find(
            (product) => product.id === value
          )

          return {
            ...item,
            product_id: value,
            unit_cost: selectedProduct
              ? Number(selectedProduct.purchase_price || 0)
              : item.unit_cost,
          }
        }

        if (field === "quantity") {
          return {
            ...item,
            quantity: Math.max(1, Number(value) || 1),
          }
        }

        return {
          ...item,
          unit_cost: Math.max(0, Number(value) || 0),
        }
      })
    )
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        product_id: "",
        quantity: 1,
        unit_cost: 0,
      },
    ])
  }

  function removeItem(index: number) {
    if (items.length === 1) return

    setItems((current) => current.filter((_, i) => i !== index))
  }

  function calculateTotal() {
    return items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.unit_cost || 0),
      0
    )
  }

  async function addPurchase() {
    try {
      setSaving(true)
      setMessage("")
      setError("")

      if (!supplierId) {
        setError("Please select a supplier.")
        return
      }

      if (!storeId) {
        setError("Please select a store.")
        return
      }

      if (items.some((item) => !item.product_id)) {
        setError("Please select a product for every purchase item.")
        return
      }

      if (items.some((item) => item.quantity <= 0)) {
        setError("Quantity must be greater than zero.")
        return
      }

      if (items.some((item) => item.unit_cost < 0)) {
        setError("Unit cost cannot be negative.")
        return
      }

      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Please login first.")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single()

      if (profileError || !profile?.tenant_id) {
        setError("Business profile not found.")
        return
      }

      const tenantId = profile.tenant_id
      const totalAmount = calculateTotal()

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          tenant_id: tenantId,
          store_id: storeId,
          supplier_id: supplierId,
          invoice_number: invoiceNumber.trim() || null,
          purchase_date: purchaseDate,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          notes: notes.trim() || null,
        })
        .select("id")
        .single()

      if (purchaseError) throw purchaseError

      const purchaseItems = items.map((item) => ({
        tenant_id: tenantId,
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      }))

      const { error: itemError } = await supabase
        .from("purchase_items")
        .insert(purchaseItems)

      if (itemError) {
        await supabase.from("purchases").delete().eq("id", purchase.id)
        throw itemError
      }

      const stockMovements = items.map((item) => ({
        tenant_id: tenantId,
        store_id: storeId,
        product_id: item.product_id,
        movement_type: "purchase",
        quantity: item.quantity,
        reference_id: purchase.id,
        notes: `Purchase ${invoiceNumber.trim() || purchase.id}`,
      }))

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(stockMovements)

      if (movementError) {
        console.error("Stock movement error:", movementError)
        setMessage(
          "Purchase created, but stock movement could not be created."
        )
      } else {
        setMessage("Purchase created and inventory updated successfully.")
      }

      setSupplierId("")
      setStoreId("")
      setInvoiceNumber("")
      setPurchaseDate(new Date().toISOString().split("T")[0])
      setPaymentStatus("pending")
      setNotes("")
      setItems([
        {
          product_id: "",
          quantity: 1,
          unit_cost: 0,
        },
      ])

      await loadPurchases()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Unable to create purchase.")
    } finally {
      setSaving(false)
    }
  }

  const totalAmount = calculateTotal()

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <p className="text-sm font-semibold text-cyan-400">
            INVENTORY PROCUREMENT
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Purchases
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Record supplier purchases and automatically update inventory.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Purchase Form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">
            Create Purchase
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Supplier
              </label>

              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="">Select supplier</option>

                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Store
              </label>

              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="">Select store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Invoice Number
              </label>

              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Purchase Date
              </label>

              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              />
            </div>

          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Payment Status
              </label>

              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Notes
              </label>

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
              />
            </div>

          </div>

          {/* Items */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Purchase Items
              </h3>

              <button
                type="button"
                onClick={addItem}
                className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-3">

              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[2fr_1fr_1fr_auto]"
                >

                  <div>
                    <label className="mb-2 block text-xs text-slate-500">
                      Product
                    </label>

                    <select
                      value={item.product_id}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "product_id",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
                    >
                      <option value="">Select product</option>

                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs text-slate-500">
                      Quantity
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "quantity",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs text-slate-500">
                      Unit Cost
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "unit_cost",
                          e.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-white outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="w-full rounded-lg border border-red-900 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-30 md:w-auto"
                    >
                      Remove
                    </button>
                  </div>

                </div>
              ))}

            </div>
          </div>

          {/* Total */}
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950 p-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <p className="text-sm text-slate-400">
                Purchase Total
              </p>

              <p className="mt-1 text-3xl font-bold text-cyan-400">
                ₹
                {totalAmount.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>

            <button
              type="button"
              onClick={addPurchase}
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Purchase"}
            </button>

          </div>
        </section>

        {/* Purchase History */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Purchase History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Recent supplier purchase records.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              Loading purchases...
            </div>
          ) : purchases.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <p className="font-medium">
                No purchases yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create your first supplier purchase above.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-950">
                    <tr>
                      <th className="px-5 py-4 font-medium text-slate-400">
                        Invoice
                      </th>

                      <th className="px-5 py-4 font-medium text-slate-400">
                        Supplier
                      </th>

                      <th className="px-5 py-4 font-medium text-slate-400">
                        Store
                      </th>

                      <th className="px-5 py-4 font-medium text-slate-400">
                        Date
                      </th>

                      <th className="px-5 py-4 font-medium text-slate-400">
                        Amount
                      </th>

                      <th className="px-5 py-4 font-medium text-slate-400">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {purchases.map((purchase) => (
                      <tr
                        key={purchase.id}
                        className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40"
                      >
                        <td className="px-5 py-4 font-medium">
                          {purchase.invoice_number || "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {purchase.supplier?.name || "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-300">
                          {purchase.store?.name || "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-400">
                          {new Date(
                            purchase.purchase_date
                          ).toLocaleDateString("en-IN")}
                        </td>

                        <td className="px-5 py-4 font-semibold">
                          ₹
                          {Number(
                            purchase.total_amount || 0
                          ).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              purchase.payment_status === "paid"
                                ? "bg-emerald-950 text-emerald-400"
                                : purchase.payment_status === "partial"
                                ? "bg-yellow-950 text-yellow-400"
                                : "bg-orange-950 text-orange-400"
                            }`}
                          >
                            {purchase.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}