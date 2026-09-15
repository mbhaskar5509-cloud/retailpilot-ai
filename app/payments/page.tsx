"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Payment = {
  id: string
  payment_method: string
  amount: number
  payment_status: string
  transaction_reference: string | null
  paid_at: string | null
  sales: {
    invoice_number: string
    total_amount: number
  } | null
}

export default function PaymentsPage() {
  const supabase = createClient()

  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  async function loadPayments() {
    setLoading(true)
    setMessage("")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setMessage("Please login first.")
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single()

    if (!profile) {
      setMessage("User profile not found.")
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        payment_method,
        amount,
        payment_status,
        transaction_reference,
        paid_at,
        sales (
          invoice_number,
          total_amount
        )
      `)
      .eq("tenant_id", profile.tenant_id)
      .order("paid_at", { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setPayments((data as Payment[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const totalCollected = payments
    .filter((p) => p.payment_status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const cashTotal = payments
    .filter(
      (p) =>
        p.payment_status === "paid" &&
        p.payment_method.toLowerCase() === "cash"
    )
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const upiTotal = payments
    .filter(
      (p) =>
        p.payment_status === "paid" &&
        p.payment_method.toLowerCase() === "upi"
    )
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const cardTotal = payments
    .filter(
      (p) =>
        p.payment_status === "paid" &&
        p.payment_method.toLowerCase() === "card"
    )
    .reduce((sum, p) => sum + Number(p.amount), 0)

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
                fontSize: "32px",
                fontWeight: 800,
                margin: 0,
                color: "#0f172a",
              }}
            >
              Payments
            </h1>

            <p
              style={{
                marginTop: "6px",
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              Track sales payments and collection history
            </p>
          </div>

          <button
            onClick={loadPayments}
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

        {/* Message */}
        {message && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              padding: "14px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            {message}
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
            title="Total Collected"
            value={`₹${totalCollected.toFixed(2)}`}
          />

          <SummaryCard
            title="Cash"
            value={`₹${cashTotal.toFixed(2)}`}
          />

          <SummaryCard
            title="UPI"
            value={`₹${upiTotal.toFixed(2)}`}
          />

          <SummaryCard
            title="Card"
            value={`₹${cardTotal.toFixed(2)}`}
          />
        </div>

        {/* Payment History */}
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
                fontWeight: 750,
                color: "#0f172a",
              }}
            >
              Payment History
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
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No payments found.
              <div style={{ marginTop: "8px", fontSize: "14px" }}>
                Complete a POS sale to create a payment.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "850px",
                }}
              >
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>Invoice</th>
                    <th style={thStyle}>Method</th>
                    <th style={thStyle}>Amount</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Transaction Ref</th>
                    <th style={thStyle}>Paid At</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={tdStyle}>
                        <strong>
                          {payment.sales?.invoice_number || "N/A"}
                        </strong>
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
                            textTransform: "uppercase",
                          }}
                        >
                          {payment.payment_method}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <strong>
                          ₹{Number(payment.amount).toFixed(2)}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "5px 10px",
                            borderRadius: "999px",
                            background:
                              payment.payment_status === "paid"
                                ? "#dcfce7"
                                : "#fef3c7",
                            color:
                              payment.payment_status === "paid"
                                ? "#166534"
                                : "#92400e",
                            fontSize: "13px",
                            fontWeight: 700,
                          }}
                        >
                          {payment.payment_status}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {payment.transaction_reference || "-"}
                      </td>

                      <td style={tdStyle}>
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Mobile styles */}
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