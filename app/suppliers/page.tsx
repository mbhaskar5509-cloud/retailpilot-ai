'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Supplier = {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_terms: string | null
  is_active: boolean
}

export default function SuppliersPage() {
  const supabase = createClient()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [tenantId, setTenantId] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')

  useEffect(() => {
    loadSuppliers()
  }, [])

  async function loadSuppliers() {
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

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setSuppliers(data ?? [])
    }

    setLoading(false)
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId) {
      setMessage('Tenant not found.')
      return
    }

    if (!name.trim()) {
      setMessage('Supplier name is required.')
      return
    }

    setMessage('Adding supplier...')

    const { error } = await supabase.from('suppliers').insert({
      tenant_id: tenantId,
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      payment_terms: paymentTerms.trim() || null,
    })

    if (error) {
      setMessage(error.message)
      return
    }

    setName('')
    setContactPerson('')
    setPhone('')
    setEmail('')
    setAddress('')
    setPaymentTerms('')

    setMessage('Supplier added successfully! 🎉')
    await loadSuppliers()
  }

  async function deactivateSupplier(id: string) {
    const { error } = await supabase
      .from('suppliers')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Supplier deactivated.')
    await loadSuppliers()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '32px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '8px',
            }}
          >
            Suppliers
          </h1>

          <p style={{ color: '#64748b' }}>
            Manage your supermarket suppliers and payment terms.
          </p>
        </div>

        {/* Add Supplier */}
        <section
          style={{
            background: 'white',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '20px',
              color: '#0f172a',
            }}
          >
            Add Supplier
          </h2>

          <form onSubmit={addSupplier}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <input
                placeholder="Supplier Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputStyle}
              />

              <input
                placeholder="Contact Person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Payment Terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                style={inputStyle}
              />

              <input
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              style={{
                marginTop: '20px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add Supplier
            </button>
          </form>

          {message && (
            <p
              style={{
                marginTop: '16px',
                color: '#475569',
              }}
            >
              {message}
            </p>
          )}
        </section>

        {/* Suppliers List */}
        <section
          style={{
            background: 'white',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              gap: '12px',
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#0f172a',
              }}
            >
              Supplier List
            </h2>

            <button
              onClick={loadSuppliers}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p>Loading suppliers...</p>
          ) : suppliers.length === 0 ? (
            <p style={{ color: '#64748b' }}>
              No suppliers added yet.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '800px',
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Supplier',
                      'Contact',
                      'Phone',
                      'Email',
                      'Payment Terms',
                      'Status',
                      'Action',
                    ].map((heading) => (
                      <th key={heading} style={thStyle}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td style={tdStyle}>
                        <strong>{supplier.name}</strong>
                      </td>

                      <td style={tdStyle}>
                        {supplier.contact_person || '-'}
                      </td>

                      <td style={tdStyle}>
                        {supplier.phone || '-'}
                      </td>

                      <td style={tdStyle}>
                        {supplier.email || '-'}
                      </td>

                      <td style={tdStyle}>
                        {supplier.payment_terms || '-'}
                      </td>

                      <td style={tdStyle}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </td>

                      <td style={tdStyle}>
                        {supplier.is_active && (
                          <button
                            onClick={() =>
                              deactivateSupplier(supplier.id)
                            }
                            style={{
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            Deactivate
                          </button>
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
    </main>
  )
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '10px',
  outline: 'none',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
}

const thStyle = {
  textAlign: 'left' as const,
  padding: '14px',
  borderBottom: '1px solid #e2e8f0',
  color: '#475569',
  fontSize: '13px',
}

const tdStyle = {
  padding: '14px',
  borderBottom: '1px solid #f1f5f9',
  color: '#334155',
  fontSize: '14px',
}