"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type ReturnRecord = {
  id: string
  return_type: string
  reason: string | null
  total_amount: number
  status: string
  created_at: string
  sales: {
    invoice_number: string
  } | null
  customers: {
    name: string
  } | null
}

type Product = {
  id: string
  name: string
  sku: string
  selling_price: number
}

export default function ReturnsPage() {
  const supabase = createClient()

  const [returns, setReturns] = useState<ReturnRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])

  const [storeId, setStoreId] = useState("")
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [reason, setReason] = useState("")
  const [returnType, setReturnType] = useState("customer_return")

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

    const [returnsResult, productsResult, storesResult] =
      await Promise.all([
        supabase
          .from("returns")
          .select(`
            id,
            return_type,
            reason,
            total_amount,
            status,
            created_at,
            sales (
              invoice_number
            ),
            customers (
              name
            )
          `)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select("id, name, sku, selling_price")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("stores")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("name"),
      ])

    if (returnsResult.error) {
      setError(returnsResult.error.message)
    } else {
      setReturns((returnsResult.data as ReturnRecord[]) || [])
    }

    if (productsResult.error) {
      setError(productsResult.error.message)
    } else {
      setProducts(productsResult.data || [])
    }

    if (storesResult.error) {
      setError(storesResult.error.message)
    } else {
      setStores(storesResult.data || [])

      if (!storeId && storesResult.data?.length) {
        setStoreId(storesResult.data[0].id)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function createReturn() {
    setMessage("")
    setError("")

    if (!storeId) {
      setError("Please select a store.")
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

    const product = products.find((p) => p.id === productId)

    if (!product) {
      setError("Product not found.")
      return
    }

    setSaving(true)

    const tenantId = await getTenantId()

    if (!tenantId) {
      setError("Tenant not found.")
      setSaving(false)
      return
    }

    const totalAmount = qty * Number(product.selling_price)

    // Create return record
    const { data: returnData, error: returnError } = await supabase
      .from("returns")
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        return_type: returnType,
        reason: reason || "Customer return",
        total_amount: totalAmount,
        status: "completed",
      })
      .select("id")
      .single()

    if (returnError) {
      setError(returnError.message)
      setSaving(false)
      return
    }

    // Create return item
    const { error: itemError } = await supabase
      .from("return_items")
      .insert({
        tenant_id: tenantId,
        return_id: returnData.id,
        product_id: productId,
        quantity: qty,
        unit_price: product.selling_price,
      })

    if (itemError) {
      setError(itemError.message)
      setSaving(false)
      return
    }

    // Add stock back through immutable stock ledger
    const { error: stockError } = await supabase
      .from("stock_movements")
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        product_id: productId,
        movement_type: "customer_return",
        quantity: qty,
        reference_id: returnData.id,
        notes: reason || "Customer return",
      })

    if (stockError) {
      setError(stockError.message)
      setSaving(false)
      return
    }

    setMessage(
      `Return created successfully. ${product.name} × ${qty} added back to stock.`
    )

    setProductId("")
    setQuantity("1")
    setReason("")

    await loadData()

    setSaving(false)
  }

  const totalReturns = returns.reduce(
    (sum, item) => sum + Number(item.total_amount),
    0
  )

  const completedReturns = returns.filter(
    (item) => item.status === "completed"
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
                color: "#0f172a",
              }}
            >
              Returns
            </h1>

            <p
              style={{
                marginTop: "6px",
                color: "#64748b",
              }}
            >
              Manage customer returns and stock recovery
            </p>
          </div>

          <button
            onClick={loadData}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "11px 18px",
              background: "#0f172a",
              color: "#ffffff",
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
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#dcfce7",
              color: "#166534",
              border: "1px solid #bbf7d0",
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#fee2e2",
              color: "#991b1b",
              border: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <SummaryCard
            title="Total Returns"
            value={`₹${totalReturns.toFixed(2)}`}
          />

          <SummaryCard
            title="Completed Returns"
            value={completedReturns.toString()}
          />

          <SummaryCard
            title="Return Records"
            value={returns.length.toString()}
          />
        </div>

        {/* Create Return */}
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
            Create Return
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <Field label="Store">
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select Store</option>

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
                <option value="">Select Product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — ₹
                    {Number(product.selling_price).toFixed(2)}
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

            <Field label="Return Type">
              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                style={inputStyle}
              >
                <option value="customer_return">
                  Customer Return
                </option>
                <option value="supplier_return">
                  Supplier Return
                </option>
              </select>
            </Field>

            <Field label="Reason">
              <input
                type="text"
                placeholder="Damaged / Wrong product"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <button
            onClick={createReturn}
            disabled={saving}
            style={{
              marginTop: "20px",
              border: "none",
              borderRadius: "10px",
              padding: "12px 20px",
              background: saving ? "#94a3b8" : "#16a34a",
              color: "#ffffff",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Processing..." : "Create Return"}
          </button>
        </section>

        {/* Return History */}
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
              Return History
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
              Loading returns...
            </div>
          ) : returns.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No returns found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "800px",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>Invoice</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Reason</th>
                    <th style={thStyle}>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {returns.map((item) => (
                    <tr key={item.id}>
                      <td style={tdStyle}>
                        {item.sales?.invoice_number || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        {item.return_type}
                      </td>

                      <td style={tdStyle}>
                        {item.customers?.name || "Walk-in Customer"}
                      </td>

                      <td style={tdStyle}>
                        <strong>
                          ₹{Number(item.total_amount).toFixed(2)}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: "5px 10px",
                            borderRadius: "999px",
                            background: "#dcfce7",
                            color: "#166534",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {item.reason || "-"}
                      </td>

                      <td style={tdStyle}>
                        {new Date(item.created_at).toLocaleString()}
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
  outline: "none",
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