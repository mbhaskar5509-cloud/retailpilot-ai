"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Store = {
  id: string
  name: string
}

type Product = {
  id: string
  name: string
  sku: string
}

type Transfer = {
  id: string
  from_store_id: string
  to_store_id: string
  status: string
  created_at: string
  notes: string | null
  from_store?: { name: string } | null
  to_store?: { name: string } | null
}

type TransferItem = {
  product_id: string
  quantity: number
}

export default function StockTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [fromStoreId, setFromStoreId] = useState("")
  const [toStoreId, setToStoreId] = useState("")
  const [notes, setNotes] = useState("")

  const [items, setItems] = useState<TransferItem[]>([
    {
      product_id: "",
      quantity: 1,
    },
  ])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    loadTransfers()
  }, [])

  async function getTenantId() {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error("Please login first.")
    }

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single()

    if (error || !profile?.tenant_id) {
      throw new Error("Business profile not found.")
    }

    return profile.tenant_id
  }

  async function loadTransfers() {
    try {
      setLoading(true)
      setError("")

      const supabase = createClient()
      const tenantId = await getTenantId()

      const [
        transfersResult,
        storesResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from("stock_transfers")
          .select(
            `
            id,
            from_store_id,
            to_store_id,
            status,
            created_at,
            notes,
            from_store:stores!stock_transfers_from_store_id_fkey(name),
            to_store:stores!stock_transfers_to_store_id_fkey(name)
          `
          )
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),

        supabase
          .from("stores")
          .select("id,name")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("products")
          .select("id,name,sku")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
      ])

      if (transfersResult.error) {
        throw transfersResult.error
      }

      if (storesResult.error) {
        throw storesResult.error
      }

      if (productsResult.error) {
        throw productsResult.error
      }

      const formattedTransfers = (transfersResult.data || []).map(
        (transfer: any) => ({
          ...transfer,
          from_store: Array.isArray(transfer.from_store)
            ? transfer.from_store[0] || null
            : transfer.from_store || null,
          to_store: Array.isArray(transfer.to_store)
            ? transfer.to_store[0] || null
            : transfer.to_store || null,
        })
      )

      setTransfers(formattedTransfers)
      setStores(storesResult.data || [])
      setProducts(productsResult.data || [])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Unable to load stock transfers.")
    } finally {
      setLoading(false)
    }
  }

  function updateItem(
    index: number,
    field: keyof TransferItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item

        if (field === "product_id") {
          return {
            ...item,
            product_id: value,
          }
        }

        return {
          ...item,
          quantity: Math.max(1, Number(value) || 1),
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
      },
    ])
  }

  function removeItem(index: number) {
    if (items.length === 1) return

    setItems((current) =>
      current.filter((_, i) => i !== index)
    )
  }

  async function createTransfer() {
    try {
      setSaving(true)
      setMessage("")
      setError("")

      if (!fromStoreId || !toStoreId) {
        setError("Please select both stores.")
        return
      }

      if (fromStoreId === toStoreId) {
        setError("From Store and To Store must be different.")
        return
      }

      if (items.some((item) => !item.product_id)) {
        setError("Please select a product for every item.")
        return
      }

      if (items.some((item) => item.quantity <= 0)) {
        setError("Transfer quantity must be greater than zero.")
        return
      }

      const supabase = createClient()
      const tenantId = await getTenantId()

      const { data: transfer, error: transferError } = await supabase
        .from("stock_transfers")
        .insert({
          tenant_id: tenantId,
          from_store_id: fromStoreId,
          to_store_id: toStoreId,
          status: "requested",
          notes: notes.trim() || null,
        })
        .select("id")
        .single()

      if (transferError) {
        throw transferError
      }

      const transferItems = items.map((item) => ({
        tenant_id: tenantId,
        transfer_id: transfer.id,
        product_id: item.product_id,
        quantity: item.quantity,
      }))

      const { error: itemsError } = await supabase
        .from("stock_transfer_items")
        .insert(transferItems)

      if (itemsError) {
        await supabase
          .from("stock_transfers")
          .delete()
          .eq("id", transfer.id)

        throw itemsError
      }

      setMessage("Stock transfer created successfully.")

      setFromStoreId("")
      setToStoreId("")
      setNotes("")
      setItems([
        {
          product_id: "",
          quantity: 1,
        },
      ])

      await loadTransfers()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Unable to create stock transfer.")
    } finally {
      setSaving(false)
    }
  }

  async function updateTransferStatus(
    transferId: string,
    newStatus: string
  ) {
    try {
      setError("")
      setMessage("")

      const supabase = createClient()

      const tenantId = await getTenantId()

      const { data: transfer, error: transferError } = await supabase
        .from("stock_transfers")
        .select(
          "id,from_store_id,to_store_id,status"
        )
        .eq("id", transferId)
        .eq("tenant_id", tenantId)
        .single()

      if (transferError) {
        throw transferError
      }

      const validTransitions: Record<string, string> = {
        draft: "requested",
        requested: "approved",
        approved: "dispatched",
        dispatched: "received",
      }

      if (validTransitions[transfer.status] !== newStatus) {
        setError(
          `Invalid status transition: ${transfer.status} → ${newStatus}`
        )
        return
      }

      if (newStatus === "dispatched") {
        const { data: transferItems, error: itemError } =
          await supabase
            .from("stock_transfer_items")
            .select("product_id,quantity")
            .eq("transfer_id", transferId)
            .eq("tenant_id", tenantId)

        if (itemError) {
          throw itemError
        }

        const movements = (transferItems || []).map((item) => ({
          tenant_id: tenantId,
          store_id: transfer.from_store_id,
          product_id: item.product_id,
          movement_type: "transfer_out",
          quantity: -Math.abs(Number(item.quantity)),
          reference_id: transferId,
          notes: "Stock transfer dispatched",
        }))

        if (movements.length > 0) {
          const { error: movementError } = await supabase
            .from("stock_movements")
            .insert(movements)

          if (movementError) {
            throw movementError
          }
        }
      }

      if (newStatus === "received") {
        const { data: transferItems, error: itemError } =
          await supabase
            .from("stock_transfer_items")
            .select("product_id,quantity")
            .eq("transfer_id", transferId)
            .eq("tenant_id", tenantId)

        if (itemError) {
          throw itemError
        }

        const movements = (transferItems || []).map((item) => ({
          tenant_id: tenantId,
          store_id: transfer.to_store_id,
          product_id: item.product_id,
          movement_type: "transfer_in",
          quantity: Math.abs(Number(item.quantity)),
          reference_id: transferId,
          notes: "Stock transfer received",
        }))

        if (movements.length > 0) {
          const { error: movementError } = await supabase
            .from("stock_movements")
            .insert(movements)

          if (movementError) {
            throw movementError
          }
        }
      }

      const { error: updateError } = await supabase
        .from("stock_transfers")
        .update({
          status: newStatus,
        })
        .eq("id", transferId)
        .eq("tenant_id", tenantId)

      if (updateError) {
        throw updateError
      }

      setMessage(
        newStatus === "received"
          ? "Transfer received and inventory updated successfully."
          : `Transfer moved to ${newStatus}.`
      )

      await loadTransfers()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Unable to update transfer.")
    }
  }

  function getNextStatus(status: string) {
    const transitions: Record<string, string> = {
      draft: "requested",
      requested: "approved",
      approved: "dispatched",
      dispatched: "received",
    }

    return transitions[status]
  }

  function getStatusClass(status: string) {
    if (status === "received") {
      return "bg-emerald-950 text-emerald-400"
    }

    if (status === "dispatched") {
      return "bg-blue-950 text-blue-400"
    }

    if (status === "approved") {
      return "bg-purple-950 text-purple-400"
    }

    if (status === "requested") {
      return "bg-yellow-950 text-yellow-400"
    }

    return "bg-slate-800 text-slate-300"
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-400">
              INVENTORY OPERATIONS
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Stock Transfers
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Move inventory between stores using a controlled transfer
              workflow.
            </p>
          </div>

          <button
            onClick={loadTransfers}
            className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold hover:bg-slate-800"
          >
            Refresh
          </button>
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

        {/* Create Transfer */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">
            Create Stock Transfer
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                From Store
              </label>

              <select
                value={fromStoreId}
                onChange={(e) => setFromStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="">Select source store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                To Store
              </label>

              <select
                value={toStoreId}
                onChange={(e) => setToStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="">Select destination store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm text-slate-300">
              Notes
            </label>

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional transfer notes"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
            />
          </div>

          {/* Items */}
          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Transfer Items
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
                  className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 md:grid-cols-[2fr_1fr_auto]"
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
                        <option
                          key={product.id}
                          value={product.id}
                        >
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

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={createTransfer}
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Transfer"}
            </button>
          </div>
        </section>

        {/* Transfer History */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Transfer History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage the transfer workflow from request to receipt.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              Loading transfers...
            </div>
          ) : transfers.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <p className="font-medium">
                No stock transfers yet.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create a transfer above to move inventory between stores.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transfers.map((transfer) => {
                const nextStatus = getNextStatus(transfer.status)

                return (
                  <div
                    key={transfer.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${getStatusClass(
                              transfer.status
                            )}`}
                          >
                            {transfer.status}
                          </span>

                          <span className="text-xs text-slate-500">
                            {new Date(
                              transfer.created_at
                            ).toLocaleString("en-IN")}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold">
                            {transfer.from_store?.name || "Source Store"}
                          </span>

                          <span className="text-cyan-400">
                            →
                          </span>

                          <span className="font-semibold">
                            {transfer.to_store?.name || "Destination Store"}
                          </span>
                        </div>

                        {transfer.notes && (
                          <p className="mt-2 text-sm text-slate-500">
                            {transfer.notes}
                          </p>
                        )}
                      </div>

                      {nextStatus && (
                        <button
                          onClick={() =>
                            updateTransferStatus(
                              transfer.id,
                              nextStatus
                            )
                          }
                          className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                        >
                          Mark {nextStatus}
                        </button>
                      )}

                      {transfer.status === "received" && (
                        <span className="rounded-xl border border-emerald-800 bg-emerald-950/30 px-5 py-3 text-sm font-semibold text-emerald-400">
                          ✓ Completed
                        </span>
                      )}

                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Workflow */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Transfer Workflow
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-5">

            {[
              "Draft",
              "Requested",
              "Approved",
              "Dispatched",
              "Received",
            ].map((status, index) => (
              <div
                key={status}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center"
              >
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-sm font-bold">
                  {index + 1}
                </div>

                <p className="mt-2 text-sm font-medium">
                  {status}
                </p>
              </div>
            ))}

          </div>
        </section>

      </div>
    </main>
  )
}