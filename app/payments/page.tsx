'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '14px',
  boxSizing: 'border-box',
  background: '#ffffff',
  color: '#0f172a',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '14px',
  borderBottom: '1px solid #e2e8f0',
  color: '#334155',
  background: '#f8fafc',
  fontSize: '13px',
  fontWeight: 700,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '14px',
  borderBottom: '1px solid #f1f5f9',
  color: '#334155',
  background: '#ffffff',
  fontSize: '14px',
}

export default function PaymentsPage() {
  const supabase = createClient()

  const [tenantId, setTenantId] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [sales, setSales] = useState<
    {
      id: string
      invoice_number: string
      total_amount: number
    }[]
  >([])

  const [saleId, setSaleId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [amount, setAmount] = useState(0)
  const [paymentStatus, setPaymentStatus] = useState('paid')
  const [transactionReference, setTransactionReference] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadPayments()
  }, [])

  async function loadPayments() {
    setLoading(true)
    setMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      setMessage('Business profile not found.')
      setLoading(false)
      return
    }

    setTenantId(profile.tenant_id)

    const [paymentsResult, salesResult] = await Promise.all([
      supabase
        .from('payments')
        .select(
          'id,payment_method,amount,payment_status,transaction_reference,paid_at,sales(invoice_number,total_amount)'
        )
        .eq('tenant_id', profile.tenant_id)
        .order('paid_at', { ascending: false }),

      supabase
        .from('sales')
        .select('id,invoice_number,total_amount')
        .eq('tenant_id', profile.tenant_id)
        .eq('status', 'completed')
        .order('sale_date', { ascending: false }),
    ])

    if (paymentsResult.error) {
      setMessage(paymentsResult.error.message)
      setLoading(false)
      return
    }

    if (salesResult.error) {
      setMessage(salesResult.error.message)
      setLoading(false)
      return
    }

    const paymentData: Payment[] = (
      paymentsResult.data ?? []
    ).map((payment) => {
      const saleRelation = Array.isArray(payment.sales)
        ? payment.sales[0] ?? null
        : payment.sales ?? null

      return {
        id: payment.id,
        payment_method: payment.payment_method,
        amount: Number(payment.amount ?? 0),
        payment_status: payment.payment_status,
        transaction_reference:
          payment.transaction_reference ?? null,
        paid_at: payment.paid_at ?? null,
        sales: saleRelation,
      }
    })

    setPayments(paymentData)
    setSales(
      (salesResult.data ?? []).map((sale) => ({
        id: sale.id,
        invoice_number: sale.invoice_number,
        total_amount: Number(sale.total_amount ?? 0),
      }))
    )

    setLoading(false)
  }

  function handleSaleChange(value: string) {
    setSaleId(value)

    const selectedSale = sales.find(
      (sale) => sale.id === value
    )

    if (selectedSale) {
      setAmount(Number(selectedSale.total_amount))
    } else {
      setAmount(0)
    }
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId || !saleId) {
      setMessage('Please select a sale.')
      return
    }

    if (amount <= 0) {
      setMessage('Payment amount must be greater than zero.')
      return
    }

    setSaving(true)
    setMessage('Saving payment...')

    const { error } = await supabase
      .from('payments')
      .insert({
        tenant_id: tenantId,
        sale_id: saleId,
        payment_method: paymentMethod,
        amount,
        payment_status: paymentStatus,
        transaction_reference:
          transactionReference.trim() || null,
        paid_at:
          paymentStatus === 'paid'
            ? new Date().toISOString()
            : null,
      })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setSaleId('')
    setPaymentMethod('cash')
    setAmount(0)
    setPaymentStatus('paid')
    setTransactionReference('')

    setMessage('Payment added successfully!')

    await loadPayments()

    setSaving(false)
  }

  const totalPaid = payments
    .filter((payment) => payment.payment_status === 'paid')
    .reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )

  const pendingAmount = payments
    .filter(
      (payment) => payment.payment_status === 'pending'
    )
    .reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    )

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        padding: '32px 20px',
        color: '#0f172a',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '6px 12px',
              borderRadius: '999px',
              background: '#dbeafe',
              color: '#1d4ed8',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '10px',
            }}
          >
            PAYMENT MANAGEMENT
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            Payments
          </h1>

          <p
            style={{
              marginTop: '8px',
              color: '#475569',
              fontSize: '15px',
            }}
          >
            Track customer payments and transaction status.
          </p>
        </div>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Total Paid
            </div>

            <div
              style={{
                marginTop: '8px',
                fontSize: '26px',
                fontWeight: 800,
                color: '#166534',
              }}
            >
              ₹{totalPaid.toFixed(2)}
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Pending Amount
            </div>

            <div
              style={{
                marginTop: '8px',
                fontSize: '26px',
                fontWeight: 800,
                color: '#b45309',
              }}
            >
              ₹{pendingAmount.toFixed(2)}
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Transactions
            </div>

            <div
              style={{
                marginTop: '8px',
                fontSize: '26px',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              {payments.length}
            </div>
          </div>
        </section>

        <section
          style={{
            background: '#ffffff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '24px',
            boxShadow: '0 4px 16px rgba(15,23,42,0.05)',
          }}
        >
          <h2
            style={{
              margin: '0 0 20px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            Add Payment
          </h2>

          {loading ? (
            <div
              style={{
                padding: '20px',
                color: '#475569',
              }}
            >
              Loading payments...
            </div>
          ) : (
            <form onSubmit={addPayment}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <select
                  value={saleId}
                  onChange={(e) =>
                    handleSaleChange(e.target.value)
                  }
                  style={inputStyle}
                  required
                >
                  <option value="">Select Sale *</option>

                  {sales.map((sale) => (
                    <option key={sale.id} value={sale.id}>
                      {sale.invoice_number} — ₹
                      {Number(sale.total_amount).toFixed(2)}
                    </option>
                  ))}
                </select>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">
                    Bank Transfer
                  </option>
                  <option value="other">Other</option>
                </select>

                <input
                  type="number"
                  value={amount}
                  onChange={(e) =>
                    setAmount(Number(e.target.value))
                  }
                  min="0.01"
                  step="0.01"
                  placeholder="Amount"
                  style={inputStyle}
                  required
                />

                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>

                <input
                  placeholder="Transaction Reference"
                  value={transactionReference}
                  onChange={(e) =>
                    setTransactionReference(e.target.value)
                  }
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                style={{
                  marginTop: '20px',
                  background: saving
                    ? '#94a3b8'
                    : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 22px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: saving
                    ? 'not-allowed'
                    : 'pointer',
                }}
              >
                {saving ? 'Saving...' : '+ Add Payment'}
              </button>
            </form>
          )}

          {message && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                color: '#334155',
                fontSize: '14px',
              }}
            >
              {message}
            </div>
          )}
        </section>

        <section
          style={{
            background: '#ffffff',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(15,23,42,0.05)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                Payment History
              </h2>

              <p
                style={{
                  margin: '5px 0 0',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Complete payment transaction history
              </p>
            </div>

            <button
              type="button"
              onClick={loadPayments}
              style={{
                padding: '9px 16px',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Refresh
            </button>
          </div>

          {payments.length === 0 ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '12px',
                color: '#475569',
              }}
            >
              No payments found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '900px',
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Invoice</th>
                    <th style={thStyle}>Sale Amount</th>
                    <th style={thStyle}>Payment</th>
                    <th style={thStyle}>Amount Paid</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Reference</th>
                    <th style={thStyle}>Paid At</th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td style={tdStyle}>
                        <strong
                          style={{ color: '#0f172a' }}
                        >
                          {payment.sales?.invoice_number || '-'}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        ₹
                        {Number(
                          payment.sales?.total_amount || 0
                        ).toFixed(2)}
                      </td>

                      <td style={tdStyle}>
                        {payment.payment_method}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                          color: '#166534',
                        }}
                      >
                        ₹{Number(payment.amount).toFixed(2)}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '5px 10px',
                            borderRadius: '999px',
                            background:
                              payment.payment_status ===
                              'paid'
                                ? '#dcfce7'
                                : payment.payment_status ===
                                    'pending'
                                  ? '#fef3c7'
                                  : '#fee2e2',
                            color:
                              payment.payment_status ===
                              'paid'
                                ? '#166534'
                                : payment.payment_status ===
                                    'pending'
                                  ? '#92400e'
                                  : '#991b1b',
                            fontWeight: 700,
                            fontSize: '12px',
                          }}
                        >
                          {payment.payment_status}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {payment.transaction_reference ||
                          '-'}
                      </td>

                      <td style={tdStyle}>
                        {payment.paid_at
                          ? new Date(
                              payment.paid_at
                            ).toLocaleString()
                          : '-'}
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