"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Expense = {
  id: string
  category: string
  description: string | null
  amount: number
  expense_date: string
  stores: {
    name: string
  } | null
}

type Store = {
  id: string
  name: string
}

export default function ExpensesPage() {
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [stores, setStores] = useState<Store[]>([])

  const [storeId, setStoreId] = useState("")
  const [category, setCategory] = useState("Rent")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function getTenantId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single()

    if (error || !profile) return null

    return profile.tenant_id
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

    const [expenseResult, storeResult] = await Promise.all([
      supabase
        .from("expenses")
        .select(`
          id,
          category,
          description,
          amount,
          expense_date,
          stores (
            name
          )
        `)
        .eq("tenant_id", tenantId)
        .order("expense_date", { ascending: false }),

      supabase
        .from("stores")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name"),
    ])

    if (expenseResult.error) {
      setError(expenseResult.error.message)
    } else {
      setExpenses((expenseResult.data as unknown as Expense[]) || [])
    }

    if (storeResult.error) {
      setError(storeResult.error.message)
    } else {
      setStores(storeResult.data || [])

      if (!storeId && storeResult.data?.length) {
        setStoreId(storeResult.data[0].id)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function addExpense() {
    setMessage("")
    setError("")

    if (!storeId) {
      setError("Please select a store.")
      return
    }

    if (!category.trim()) {
      setError("Please enter an expense category.")
      return
    }

    const numericAmount = Number(amount)

    if (!numericAmount || numericAmount <= 0) {
      setError("Amount must be greater than 0.")
      return
    }

    if (!expenseDate) {
      setError("Please select an expense date.")
      return
    }

    setSaving(true)

    const tenantId = await getTenantId()

    if (!tenantId) {
      setError("Tenant not found.")
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase
      .from("expenses")
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        category: category.trim(),
        description: description.trim() || null,
        amount: numericAmount,
        expense_date: expenseDate,
      })

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    setMessage("Expense added successfully.")

    setCategory("Rent")
    setDescription("")
    setAmount("")
    setExpenseDate(new Date().toISOString().split("T")[0])

    await loadData()

    setSaving(false)
  }

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  )

  const currentMonth = new Date().toISOString().slice(0, 7)

  const monthlyExpenses = expenses
    .filter((expense) => expense.expense_date.startsWith(currentMonth))
    .reduce((sum, expense) => sum + Number(expense.amount), 0)

  const averageExpense =
    expenses.length > 0 ? totalExpenses / expenses.length : 0

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
              Expenses
            </h1>

            <p
              style={{
                marginTop: "6px",
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              Track store expenses and operating costs
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
              border: "1px solid #bbf7d0",
              color: "#166534",
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
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          <SummaryCard
            title="Total Expenses"
            value={`₹${totalExpenses.toFixed(2)}`}
          />

          <SummaryCard
            title="This Month"
            value={`₹${monthlyExpenses.toFixed(2)}`}
          />

          <SummaryCard
            title="Expense Records"
            value={expenses.length.toString()}
          />

          <SummaryCard
            title="Average Expense"
            value={`₹${averageExpense.toFixed(2)}`}
          />
        </div>

        {/* Add Expense */}
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
              color: "#0f172a",
            }}
          >
            Add Expense
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

            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={inputStyle}
              >
                <option value="Rent">Rent</option>
                <option value="Electricity">Electricity</option>
                <option value="Salary">Salary</option>
                <option value="Transport">Transport</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Marketing">Marketing</option>
                <option value="Internet">Internet</option>
                <option value="Supplies">Supplies</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Expense Date">
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={inputStyle}
              />
            </Field>

            <Field label="Description">
              <input
                type="text"
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <button
            onClick={addExpense}
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
            {saving ? "Saving..." : "Add Expense"}
          </button>
        </section>

        {/* Expense History */}
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
                color: "#0f172a",
              }}
            >
              Expense History
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
              Loading expenses...
            </div>
          ) : expenses.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No expenses found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: "750px",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Store</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Description</th>
                    <th style={thStyle}>Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td style={tdStyle}>
                        {new Date(
                          expense.expense_date
                        ).toLocaleDateString()}
                      </td>

                      <td style={tdStyle}>
                        {expense.stores?.name || "N/A"}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "5px 10px",
                            borderRadius: "999px",
                            background: "#f1f5f9",
                            color: "#334155",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {expense.category}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {expense.description || "-"}
                      </td>

                      <td style={tdStyle}>
                        <strong>
                          ₹{Number(expense.amount).toFixed(2)}
                        </strong>
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