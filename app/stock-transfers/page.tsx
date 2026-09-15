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
  notes: string | null
  created_at: string
  from_store: { name: string } | null
  to_store: { name: string } | null
}

export default function StockTransfersPage() {
  const supabase = createClient()

  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])

  const [fromStoreId, setFromStoreId] = useState("")
  const [toStoreId, setToStoreId] = useState("")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [notes, setNotes] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function getTenantId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single()

    return profile?.tenant_id || null
  }

  async function loadData() {
    setLoading(true)
    setError("")

    const tenantId = await getTenantId()

    if (!tenantId) {
      setError("User profile or tenant not found.")
      setLoading(false)
      return
    }

    const [storesResult, productsResult, transfersResult] =
      await Promise.all([
        supabase
          .from("stores")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("products")
          .select("id, name, sku")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("stock_transfers")
          .select(`
            id,
            from_store_id,
            to_store_id,
            status,
            notes,
            created_at,
            from_store:stores!stock_transfers_from_store_id_fkey (
              name
            ),
            to_store:stores!stock_transfers_to_store_id_fkey (
              name
            )
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
      ])

    if (storesResult.error) {
      setError(storesResult.error.message)
    } else {
      setStores(storesResult.data || [])
    }

    if (productsResult.error) {
      setError(productsResult.error.message)
    } else {
      setProducts(productsResult.data || [])
    }

    if (transfersResult.error) {
      setError(transfersResult.error.message)
    } else {
      setTransfers((transfersResult.data as Transfer[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function createTransfer() {
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

    if (!productId) {
      setError("Please select a product.")
      return
    }

    const qty = Number(quantity)

    if (!qty || qty <= 0) {
      setError("Quantity must be greater than 0.")
      return
    }

    const tenantId = await getTenantId()

    if (!tenantId) {
      setError("Tenant not found.")
      return
    }

    setSaving(true)

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
      setError(transferError.message)
      setSaving(false)
      return
    }

    const { error: itemError } = await supabase
      .from("stock_transfer_items")
      .insert({
        tenant_id: tenantId,
        transfer_id: transfer.id,
        product_id: productId,
        quantity: qty,
      })

    if (itemError) {
      setError(itemError.message)
      setSaving(false)
      return
    }

    setMessage("Stock transfer requested successfully.")

    setProductId("")
    setQuantity("1")
    setNotes("")

    await loadData()

    setSaving(false)
  }

  async function updateTransferStatus(
    transfer: Transfer,
    newStatus: string
  ) {
    setMessage("")
    setError("")

    const tenantId = await getTenantId()

    if (!tenantId) {
      setError("Tenant not found.")
      return
    }

    const validTransitions: Record<string, string[]> = {
      requested: ["approved"],
      approved: ["dispatched"],
      dispatched: ["received"],
    }

    if (!validTransitions[transfer.status]?.includes(newStatus)) {
      setError(
        `Invalid transfer transition: ${transfer.status} → ${newStatus}`
      )
      return
    }

    // When dispatching, create transfer_out ledger movements.
    if (newStatus === "dispatched") {
      const { data: items, error: itemsError } = await supabase
        .from("stock_transfer_items")
        .select("product_id, quantity")
        .eq("tenant_id", tenantId)
        .eq("transfer_id", transfer.id)

      if (itemsError) {
        setError(itemsError.message)
        return
      }

      if (!items || items.length === 0) {
        setError("Transfer has no items.")
        return
      }

      const movements = items.map((item) => ({
        tenant_id: tenantId,
        store_id: transfer.from_store_id,
        product_id: item.product_id,
        movement_type: "transfer_out",
        quantity: -Math.abs(Number(item.quantity)),
        reference_id: transfer.id,
        notes: "Stock transfer dispatched",
      }))

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(movements)

      if (movementError) {
        setError(movementError.message)
        return
      }
    }

    // When received, create transfer_in ledger movements.
    if (newStatus === "received") {
      const { data: items, error: itemsError } = await supabase
        .from("stock_transfer_items")
        .select("product_id, quantity")
        .eq("tenant_id", tenantId)
        .eq("transfer_id", transfer.id)

      if (itemsError) {
        setError(itemsError.message)
        return
      }

      if (!items || items.length === 0) {
        setError("Transfer has no items.")
        return
      }

      const movements = items.map((item) => ({
        tenant_id: tenantId,
        store_id: transfer.to_store_id,
        product_id: item.product_id,
        movement_type: "transfer_in",
        quantity: Math.abs(Number(item.quantity)),
        reference_id: transfer.id,
        notes: "Stock transfer received",
      }))

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert(movements)

      if (movementError) {
        setError(movementError.message)
        return
      }
    }

    const { error: updateError } = await supabase
      .from("stock_transfers")
      .update({ status: newStatus })
      .eq("id", transfer.id)
      .eq("tenant_id", tenantId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setMessage(`Transfer status updated to ${newStatus}.`)

    await loadData()
  }

  const requested = transfers.filter(
    (t) => t.status === "requested"
  ).length

  const approved = transfers.filter(
    (t) => t.status === "approved"
  ).length

  const received = transfers.filter(
    (t) => t.status === "received"
  ).length

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "32px",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "28px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 800,
              }}
            >
              Stock Transfers
            </h1>

            <p
              style={{
                marginTop: "6px",
                color: "#64748b",
              }}
            >
              Move inventory safely between stores
            </p>
          </div>

          <button
            onClick={loadData}
            style={{
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "11px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              border: "1px solid #bbf7d0",
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <SummaryCard
            title="Total Transfers"
            value={transfers.length.toString()}
          />

          <SummaryCard
            title="Requested"
            value={requested.toString()}
          />

          <SummaryCard
            title="Approved"
            value={approved.toString()}
          />

          <SummaryCard
            title="Received"
            value={received.toString()}
          />
        </div>

        {/* Create Transfer */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            padding: "24px",
            marginBottom: "28px",
            boxShadow: "0 4px 15px rgba(15, 23, 42, 0.04)",
          }}
        >
          <h2
            style={{
              margin: "0 0 20px",
              fontSize: "20px",
              fontWeight: 800,
            }}
          >
            Create Stock Transfer
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <Field label="From Store">
              <select
                value={fromStoreId}
                onChange={(e) => setFromStoreId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select source store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="To Store">
              <select
                value={toStoreId}
                onChange={(e) => setToStoreId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select destination store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Product">
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.sku}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Quantity">
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Notes">
              <input
                type="text"
                placeholder="Optional transfer note"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <button
            onClick={createTransfer}
            disabled={saving}
            style={{
              marginTop: "20px",
              background: saving ? "#94a3b8" : "#16a34a",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              padding: "12px 22px",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Creating..." : "Request Transfer"}
          </button>
        </section>

        {/* Transfer History */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 4px 15px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              Transfer History
            </h2>
          </div>

          {loading ? (
            <div
              style={{
                padding: "40px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading transfers...
            </div>
          ) : transfers.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No stock transfers found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "850px",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>From</th>
                    <th style={thStyle}>To</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Notes</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {transfers.map((transfer) => (
                    <tr key={transfer.id}>
                      <td style={tdStyle}>
                        {transfer.from_store?.name || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        {transfer.to_store?.name || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        <StatusBadge status={transfer.status} />
                      </td>

                      <td style={tdStyle}>
                        {transfer.notes || "-"}
                      </td>

                      <td style={tdStyle}>
                        {new Date(
                          transfer.created_at
                        ).toLocaleString()}
                      </td>

                      <td style={tdStyle}>
                        {transfer.status === "requested" && (
                          <ActionButton
                            label="Approve"
                            onClick={() =>
                              updateTransferStatus(
                                transfer,
                                "approved"
                              )
                            }
                          />
                        )}

                        {transfer.status === "approved" && (
                          <ActionButton
                            label="Dispatch"
                            onClick={() =>
                              updateTransferStatus(
                                transfer,
                                "dispatched"
                              )
                            }
                          />
                        )}

                        {transfer.status === "dispatched" && (
                          <ActionButton
                            label="Receive"
                            onClick={() =>
                              updateTransferStatus(
                                transfer,
                                "received"
                              )
                            }
                          />
                        )}

                        {transfer.status === "received" && (
                          <span
                            style={{
                              color: "#16a34a",
                              fontWeight: 700,
                              fontSize: "13px",
                            }}
                          >
                            Completed
                          </span>
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

      <style jsx>{`
        @media (max-width: 640px) {
          main {
            padding: 20px !important;
          }

          h1 {
            font-size: 26px !important;
          }
        }
      `}</style>
    </main>
  )
}

function SummaryCard({
  title,
  value,
}: {
  title: string
  value: string
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "20px",
        boxShadow: "0 4px 15px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "14px",
          fontWeight: 600,
          marginBottom: "8px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: "#0f172a",
          fontSize: "25px",
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: "7px",
          fontSize: "14px",
          fontWeight: 700,
          color: "#334155",
        }}
      >
        {label}
      </label>

      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const background =
    status === "received"
      ? "#dcfce7"
      : status === "dispatched"
        ? "#dbeafe"
        : status === "approved"
          ? "#fef3c7"
          : "#f1f5f9"

  const color =
    status === "received"
      ? "#166534"
      : status === "dispatched"
        ? "#1d4ed8"
        : status === "approved"
          ? "#92400e"
          : "#475569"

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 10px",
        borderRadius: "999px",
        background,
        color,
        fontSize: "13px",
        fontWeight: 700,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  )
}

function ActionButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        borderRadius: "8px",
        padding: "8px 12px",
        background: "#0f172a",
        color: "#ffffff",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "13px",
  color: "#475569",
  fontWeight: 700,
  borderBottom: "1px solid #e2e8f0",
}

const tdStyle: React.CSSProperties = {
  padding: "15px 16px",
  fontSize: "14px",
  color: "#334155",
  borderBottom: "1px solid #f1f5f9",
}