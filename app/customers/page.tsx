'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Customer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyalty_points: number
  created_at: string
}

export default function CustomersPage() {
  const supabase = createClient()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    setLoading(true)

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

    if (profileError || !profile?.tenant_id) {
      setMessage('Business profile not found.')
      setLoading(false)
      return
    }

    setTenantId(profile.tenant_id)

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setCustomers(data ?? [])
    }

    setLoading(false)
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId) {
      setMessage('Tenant not found.')
      return
    }

    setMessage('Adding customer...')

    const { error } = await supabase.from('customers').insert({
      tenant_id: tenantId,
      name,
      phone: phone || null,
      email: email || null,
      loyalty_points: 0,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Customer added successfully!')

    setName('')
    setPhone('')
    setEmail('')

    await loadCustomers()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: '700',
              color: '#0f172a',
            }}
          >
            Customers
          </h1>

          <p
            style={{
              marginTop: '8px',
              color: '#64748b',
              fontSize: '15px',
            }}
          >
            Manage customer information and loyalty points.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '10px',
              backgroundColor: '#e2e8f0',
              color: '#0f172a',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {message}
          </div>
        )}

        {/* Add Customer */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '24px',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              margin: '0 0 6px',
              fontSize: '21px',
              color: '#0f172a',
            }}
          >
            Add New Customer
          </h2>

          <p
            style={{
              margin: '0 0 20px',
              color: '#64748b',
              fontSize: '14px',
            }}
          >
            Add customer details for billing and loyalty management.
          </p>

          <form onSubmit={addCustomer}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  Customer Name
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Customer name"
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  Phone
                </label>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@email.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: '20px',
                padding: '12px 22px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              + Add Customer
            </button>
          </form>
        </section>

        {/* Customer List */}
        <section
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '15px',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '21px',
                  color: '#0f172a',
                }}
              >
                Customer List
              </h2>

              <p
                style={{
                  margin: '5px 0 0',
                  fontSize: '14px',
                  color: '#64748b',
                }}
              >
                {customers.length} customer
                {customers.length !== 1 ? 's' : ''}
              </p>
            </div>

            <button
              onClick={loadCustomers}
              style={{
                padding: '9px 15px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div
              style={{
                padding: '50px 20px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#334155',
                }}
              >
                No customers yet
              </p>

              <p
                style={{
                  marginTop: '8px',
                  fontSize: '14px',
                  color: '#64748b',
                }}
              >
                Add your first customer above.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '700px',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc' }}>
                    <th style={headerStyle}>Customer</th>
                    <th style={headerStyle}>Phone</th>
                    <th style={headerStyle}>Email</th>
                    <th style={headerStyle}>Loyalty Points</th>
                    <th style={headerStyle}>Joined</th>
                  </tr>
                </thead>

                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      style={{
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <td style={cellStyle}>
                        <strong style={{ color: '#0f172a' }}>
                          {customer.name}
                        </strong>
                      </td>

                      <td style={cellStyle}>
                        {customer.phone || '-'}
                      </td>

                      <td style={cellStyle}>
                        {customer.email || '-'}
                      </td>

                      <td style={cellStyle}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '5px 9px',
                            borderRadius: '999px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                        >
                          {customer.loyalty_points} points
                        </span>
                      </td>

                      <td style={cellStyle}>
                        {new Date(
                          customer.created_at
                        ).toLocaleDateString()}
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

const headerStyle: React.CSSProperties = {
  padding: '13px 18px',
  textAlign: 'left',
  fontSize: '12px',
  fontWeight: '700',
  color: '#64748b',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const cellStyle: React.CSSProperties = {
  padding: '15px 18px',
  fontSize: '14px',
  color: '#475569',
  whiteSpace: 'nowrap',
}