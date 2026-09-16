'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Store = {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  manager_name: string | null
  is_active: boolean
}

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [managerName, setManagerName] = useState('')

  useEffect(() => {
    loadStores()
  }, [])

  async function getTenantId() {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return null
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (error || !profile) {
      setMessage('Business profile not found.')
      return null
    }

    return profile.tenant_id
  }

  async function loadStores() {
    setLoading(true)
    setMessage('')

    const supabase = createClient()
    const tenantId = await getTenantId()

    if (!tenantId) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setStores(data ?? [])
    }

    setLoading(false)
  }

  async function handleAddStore(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setMessage('Store name is required.')
      return
    }

    setSaving(true)
    setMessage('')

    const supabase = createClient()
    const tenantId = await getTenantId()

    if (!tenantId) {
      setSaving(false)
      return
    }

    const { error } = await supabase.from('stores').insert({
      tenant_id: tenantId,
      name: name.trim(),
      address: address.trim() || null,
      city: city.trim() || null,
      phone: phone.trim() || null,
      manager_name: managerName.trim() || null,
      is_active: true,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Store added successfully! 🎉')

      setName('')
      setAddress('')
      setCity('')
      setPhone('')
      setManagerName('')

      await loadStores()
    }

    setSaving(false)
  }

  async function handleDeactivateStore(id: string) {
    const confirmed = window.confirm(
      'Are you sure you want to deactivate this store?'
    )

    if (!confirmed) return

    const supabase = createClient()

    const { error } = await supabase
      .from('stores')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Store deactivated successfully.')
      await loadStores()
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        fontFamily: 'Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <header
        style={{
          background: '#0f172a',
          color: 'white',
          padding: '20px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '24px' }}>
            🛍️ RetailPilot AI
          </h1>

          <p
            style={{
              margin: '5px 0 0',
              color: '#94a3b8',
              fontSize: '13px',
            }}
          >
            Store Management
          </p>
        </div>

        <button
          onClick={() => {
            window.location.href = '/dashboard'
          }}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          ← Dashboard
        </button>
      </header>

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '30px 20px',
        }}
      >
        <div style={{ marginBottom: '25px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '28px',
            }}
          >
            Stores
          </h2>

          <p
            style={{
              color: '#64748b',
              marginTop: '7px',
            }}
          >
            Manage supermarket branches and store information.
          </p>
        </div>

        {message && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d4ed8',
              padding: '13px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
            }}
          >
            {message}
          </div>
        )}

        <section
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '25px',
            marginBottom: '25px',
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: '20px',
            }}
          >
            ➕ Add New Store
          </h3>

          <form onSubmit={handleAddStore}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              <InputField
                label="Store Name *"
                placeholder="Example: RetailPilot Main Store"
                value={name}
                onChange={setName}
              />

              <InputField
                label="City"
                placeholder="Example: Hyderabad"
                value={city}
                onChange={setCity}
              />

              <InputField
                label="Phone"
                placeholder="Example: 9876543210"
                value={phone}
                onChange={setPhone}
              />

              <InputField
                label="Manager Name"
                placeholder="Example: Store Manager"
                value={managerName}
                onChange={setManagerName}
              />

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Address</label>

                <textarea
                  placeholder="Enter complete store address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: '20px',
                background: saving ? '#94a3b8' : '#2563eb',
                color: 'white',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '8px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              {saving ? 'Saving...' : 'Add Store'}
            </button>
          </form>
        </section>

        <section
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 25px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>🏪 Store List</h3>

              <p
                style={{
                  margin: '5px 0 0',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                {stores.length} store
                {stores.length !== 1 ? 's' : ''}
              </p>
            </div>

            <button
              onClick={loadStores}
              style={{
                border: '1px solid #cbd5e1',
                background: 'white',
                padding: '8px 13px',
                borderRadius: '7px',
                cursor: 'pointer',
              }}
            >
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
              }}
            >
              Loading stores...
            </div>
          ) : stores.length === 0 ? (
            <div
              style={{
                padding: '50px 20px',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <div style={{ fontSize: '40px' }}>🏪</div>

              <h3 style={{ color: '#334155' }}>
                No stores yet
              </h3>

              <p>Add your first supermarket branch above.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '850px',
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: '#f8fafc',
                      textAlign: 'left',
                    }}
                  >
                    <th style={thStyle}>Store</th>
                    <th style={thStyle}>City</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Manager</th>
                    <th style={thStyle}>Address</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {stores.map((store) => (
                    <tr key={store.id}>
                      <td style={tdStyle}>
                        <strong>{store.name}</strong>
                      </td>

                      <td style={tdStyle}>
                        {store.city || '-'}
                      </td>

                      <td style={tdStyle}>
                        {store.phone || '-'}
                      </td>

                      <td style={tdStyle}>
                        {store.manager_name || '-'}
                      </td>

                      <td style={tdStyle}>
                        {store.address || '-'}
                      </td>

                      <td style={tdStyle}>
                        <span
                          style={{
                            background: store.is_active
                              ? '#dcfce7'
                              : '#fee2e2',
                            color: store.is_active
                              ? '#166534'
                              : '#991b1b',
                            padding: '5px 9px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        >
                          {store.is_active
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        {store.is_active && (
                          <button
                            onClick={() =>
                              handleDeactivateStore(store.id)
                            }
                            style={{
                              border: 'none',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              padding: '7px 10px',
                              borderRadius: '6px',
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

function InputField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600' as const,
  marginBottom: '7px',
  color: '#334155',
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: '11px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  background: 'white',
}

const thStyle = {
  padding: '14px 16px',
  fontSize: '12px',
  color: '#64748b',
  borderBottom: '1px solid #e2e8f0',
}

const tdStyle = {
  padding: '15px 16px',
  fontSize: '13px',
  borderBottom: '1px solid #f1f5f9',
}

