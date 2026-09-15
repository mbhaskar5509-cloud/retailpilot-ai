"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Sale = {
  id: string
  invoice_no: string | null
  total_amount: number
  created_at: string
}

type ReturnRecord = {
  id: string
  sale_id: string | null
  return_type: string
  reason: string | null
  total_amount: number
  created_at: string
  sale?: {
    invoice_no: string | null
  } | null
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRecord[]>([])
  const [sales, setSales] = useState<Sale[]>([])

  const [saleId, setSaleId] = useState("")
  const [returnType, setReturnType] = useState("customer_return")
  const [reason, setReason] = useState("")
  const [amount, setAmount] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    loadData()
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

  async function loadData() {
    try {
      setLoading(true)
      setError("")

      const supabase = createClient()
      const tenantId = await getTenantId()

      const { data: returnData, error: returnError } = await supabase
        .from("returns")
        .select(
          `
          id,
          sale_id,
          return_type,
          reason,
          total_amount,
          created_at,
          sale:sales!returns_sale_id_fkey(invoice_no)
        `
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })

      if (returnError) {
        throw returnError
      }

      const { data: salesData, error: salesError } = await supabase
        .from("sales")
        .select("id, invoice_no, total_amount, created_at")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })

      if (salesError) {
        throw salesError
      }

      const formattedReturns = (returnData || []).map((item: any) => ({
        ...item,
        sale: Array.isArray(item.sale)
          ? item.sale[0] || null
          : item.sale || null,
      }))

      setReturns(formattedReturns)
      setSales(salesData || [])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Unable to load returns.")
    } finally {
      setLoading(false)
    }
  }

  async function createReturn() {
    try {
      setSaving(true)
      setMessage("")
      setError("")

      if (!saleId) {
        setError("Please select a sale.")
        return
      }

      const returnAmount = Number(amount)

      if (!returnAmount || returnAmount <= 0) {
        setError("Return amount must be greater than zero.")
        return
      }

      const selectedSale = sales.find((sale) => sale.id === saleId)

      if (!selectedSale) {
        setError("Selected sale not found.")
        return
      }

      if (returnAmount > Number(selectedSale.total_amount)) {
        setError("Return amount cannot exceed the sale amount.")
        return
      }

      const supabase = createClient()
      const tenantId = await getTenantId()

      const { error: insertError } = await supabase
        .from("returns")
        .insert({
          tenant_id: tenantId,
          sale_id: saleId,
          return_type: returnType,
          reason: reason.trim() || null,
          total_amount: returnAmount,
        })

      if (insertError) {
        throw insertError
      }

      setMessage("Return created successfully.")
      setSaleId("")
      setReturnType("customer_return")
      setReason("")
      setAmount("")

      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || "Unable to create return.")
    } finally {
      setSaving(false)
    }
  }

  function getTypeClass(type: string) {
    if (type === "customer_return") {
      return "bg-orange-950 text-orange-400"
    }

    if (type === "supplier_return") {
      return "bg-purple-950 text-purple-400"
    }

    return "bg-slate-800 text-slate-300"
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-400">
              SALES OPERATIONS
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Returns
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Manage customer and supplier returns with a clear audit trail.
            </p>
          </div>

          <button
            onClick={loadData}
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

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6">
          <h2 className="text-xl font-semibold">
            Create Return
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Sale / Invoice
              </label>

              <select
                value={saleId}
                onChange={(e) => {
                  setSaleId(e.target.value)

                  const sale = sales.find(
                    (item) => item.id === e.target.value
                  )

                  if (sale) {
                    setAmount(String(sale.total_amount))
                  }
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="">
                  Select completed sale
                </option>

                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.invoice_no || sale.id.slice(0, 8)} — ₹
                    {Number(sale.total_amount).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Return Type
              </label>

              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white outline-none focus:border-cyan-500"
              >
                <option value="customer_return">
                  Customer Return
                </option>

                <option value="supplier_return">
                  Supplier Return
                </option>
              </select>
            </div>

          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Return Amount
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                Reason
              </label>

              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for return"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
              />
            </div>

          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={createReturn}
              disabled={saving}
              className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Return"}
            </button>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">
              Return History
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Review previously recorded returns.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
              Loading returns...
            </div>
          ) : returns.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
              <p className="font-medium">
                No returns recorded yet.
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create a return above to see it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">

              {returns.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                    <div>
                      <div className="flex flex-wrap items-center gap-3">

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${getTypeClass(
                            item.return_type
                          )}`}
                        >
                          {item.return_type.replace("_", " ")}
                        </span>

                        <span className="text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString("en-IN")}
                        </span>

                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        <span className="text-slate-400">
                          Invoice:
                        </span>

                        <span className="font-semibold">
                          {item.sale?.invoice_no || "N/A"}
                        </span>
                      </div>

                      {item.reason && (
                        <p className="mt-2 text-sm text-slate-500">
                          Reason: {item.reason}
                        </p>
                      )}
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs text-slate-500">
                        Return Amount
                      </p>

                      <p className="mt-1 text-2xl font-bold text-orange-400">
                        ₹{Number(item.total_amount).toFixed(2)}
                      </p>
                    </div>

                  </div>
                </div>
              ))}

            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">
            Return Management
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-500">
                Total Returns
              </p>

              <p className="mt-2 text-2xl font-bold">
                {returns.length}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-500">
                Customer Returns
              </p>

              <p className="mt-2 text-2xl font-bold">
                {
                  returns.filter(
                    (item) =>
                      item.return_type === "customer_return"
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-sm text-slate-500">
                Total Return Value
              </p>

              <p className="mt-2 text-2xl font-bold text-orange-400">
                ₹
                {returns
                  .reduce(
                    (sum, item) =>
                      sum + Number(item.total_amount || 0),
                    0
                  )
                  .toFixed(2)}
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  )
}