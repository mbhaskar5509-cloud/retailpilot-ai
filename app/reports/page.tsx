"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type ReportData = {
  salesCount: number
  revenue: number
  expenses: number
  purchases: number
  products: number
  customers: number
  lowStock: number
  profit: number
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData>({
    salesCount: 0,
    revenue: 0,
    expenses: 0,
    purchases: 0,
    products: 0,
    customers: 0,
    lowStock: 0,
    profit: 0,
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    try {
      setLoading(true)
      setError("")

      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Please login to view reports.")
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

      const [
        salesResult,
        expensesResult,
        purchasesResult,
        productsResult,
        customersResult,
        stockResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("id,total_amount")
          .eq("tenant_id", tenantId)
          .eq("status", "completed"),

        supabase
          .from("expenses")
          .select("amount")
          .eq("tenant_id", tenantId),

        supabase
          .from("purchases")
          .select("total_amount")
          .eq("tenant_id", tenantId),

        supabase
          .from("products")
          .select("id,reorder_level")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),

        supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenantId),

        supabase
          .from("stock_movements")
          .select("product_id,quantity")
          .eq("tenant_id", tenantId),
      ])

      if (salesResult.error) throw salesResult.error
      if (expensesResult.error) throw expensesResult.error
      if (purchasesResult.error) throw purchasesResult.error
      if (productsResult.error) throw productsResult.error
      if (customersResult.error) throw customersResult.error
      if (stockResult.error) throw stockResult.error

      const sales = salesResult.data || []
      const expenses = expensesResult.data || []
      const purchases = purchasesResult.data || []
      const products = productsResult.data || []
      const customers = customersResult.data || []
      const movements = stockResult.data || []

      const revenue = sales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      )

      const expenseTotal = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      )

      const purchaseTotal = purchases.reduce(
        (sum, purchase) => sum + Number(purchase.total_amount || 0),
        0
      )

      const stockMap: Record<string, number> = {}

      for (const movement of movements) {
        const productId = movement.product_id

        if (!stockMap[productId]) {
          stockMap[productId] = 0
        }

        stockMap[productId] += Number(movement.quantity || 0)
      }

      const lowStock = products.filter((product) => {
        const currentStock = stockMap[product.id] || 0
        return currentStock <= Number(product.reorder_level || 0)
      }).length

      const profit = revenue - purchaseTotal - expenseTotal

      setData({
        salesCount: sales.length,
        revenue,
        expenses: expenseTotal,
        purchases: purchaseTotal,
        products: products.length,
        customers: customers.length,
        lowStock,
        profit,
      })
    } catch (err) {
      console.error(err)
      setError("Unable to load reports.")
    } finally {
      setLoading(false)
    }
  }

  function formatCurrency(value: number) {
    return `₹${value.toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              BUSINESS ANALYTICS
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Reports
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Real-time business performance and operational overview.
            </p>
          </div>

          <button
            onClick={loadReports}
            className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Refresh Reports
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-cyan-400" />
            <p className="text-slate-400">
              Loading live business reports...
            </p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Total Revenue</p>
                <p className="mt-2 text-3xl font-bold">
                  {formatCurrency(data.revenue)}
                </p>
                <p className="mt-2 text-xs text-emerald-400">
                  Completed sales
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Estimated Profit</p>
                <p
                  className={`mt-2 text-3xl font-bold ${
                    data.profit >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {formatCurrency(data.profit)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Revenue − purchases − expenses
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Total Expenses</p>
                <p className="mt-2 text-3xl font-bold text-orange-400">
                  {formatCurrency(data.expenses)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Recorded business expenses
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-sm text-slate-400">Purchases</p>
                <p className="mt-2 text-3xl font-bold text-blue-400">
                  {formatCurrency(data.purchases)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Purchase records
                </p>
              </div>

            </section>

            {/* Operational Summary */}
            <section className="mt-6">
              <h2 className="mb-4 text-xl font-semibold">
                Operational Summary
              </h2>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">
                    Completed Sales
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {data.salesCount}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Successful transactions
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">
                    Active Products
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {data.products}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Products currently active
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">
                    Customers
                  </p>

                  <p className="mt-2 text-3xl font-bold">
                    {data.customers}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Registered customers
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">
                    Low Stock Items
                  </p>

                  <p
                    className={`mt-2 text-3xl font-bold ${
                      data.lowStock > 0
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {data.lowStock}
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Reorder attention required
                  </p>
                </div>

              </div>
            </section>

            {/* Financial Overview */}
            <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Financial Overview
              </h2>

              <div className="mt-6 space-y-5">

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-400">
                      Revenue
                    </span>

                    <span className="font-semibold">
                      {formatCurrency(data.revenue)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${
                          data.revenue > 0 ? 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-400">
                      Purchases
                    </span>

                    <span className="font-semibold">
                      {formatCurrency(data.purchases)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{
                        width: `${
                          data.revenue > 0
                            ? Math.min(
                                (data.purchases / data.revenue) * 100,
                                100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-400">
                      Expenses
                    </span>

                    <span className="font-semibold">
                      {formatCurrency(data.expenses)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-orange-500"
                      style={{
                        width: `${
                          data.revenue > 0
                            ? Math.min(
                                (data.expenses / data.revenue) * 100,
                                100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-400">
                      Estimated Profit
                    </span>

                    <span
                      className={`font-semibold ${
                        data.profit >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {formatCurrency(data.profit)}
                    </span>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        data.profit >= 0
                          ? "bg-emerald-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${
                          data.revenue > 0
                            ? Math.min(
                                Math.abs(data.profit / data.revenue) *
                                  100,
                                100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

              </div>
            </section>

            {/* AI Disclaimer */}
            <div className="mt-6 rounded-2xl border border-cyan-900/50 bg-cyan-950/20 p-5">
              <p className="text-sm font-semibold text-cyan-300">
                AI-generated recommendation
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Reports use live business data from your RetailPilot AI
                database. Financial figures shown here are operational
                estimates and should be reviewed before making business
                decisions.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}