'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    setEmail(user.email ?? '')

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    let tenantId = profile?.tenant_id

    if (!tenantId) {
      const { data: newTenantId, error } = await supabase.rpc(
        'setup_my_tenant',
        {
          tenant_name: 'RetailPilot Supermarket',
          user_name: user.email ?? 'Business Owner',
        }
      )

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      tenantId = newTenantId
    }

    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single()

      setTenantName(tenant?.name ?? '')
    }

    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px' }}>🛍️</div>
          <h2>Loading RetailPilot AI...</h2>
          <p style={{ color: '#64748b' }}>Preparing your dashboard</p>
        </div>
      </main>
    )
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
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
        }}
      >
        {/* SIDEBAR */}
        <aside
          style={{
            width: '250px',
            background: '#0f172a',
            color: 'white',
            padding: '24px 16px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: '22px',
              fontWeight: '700',
              padding: '0 12px',
              marginBottom: '35px',
            }}
          >
            🛍️ RetailPilot
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginTop: '5px',
                fontWeight: '400',
              }}
            >
              AI Retail Management
            </div>
          </div>

          <nav>
            {[
  ['📊', 'Dashboard', '/dashboard'],
  ['📦', 'Products', '/products'],
  ['🏪', 'Stores', '#'],
  ['🚚', 'Purchases', '#'],
  ['📋', 'Inventory', '#'],
  ['🛒', 'POS Sales', '#'],
  ['👥', 'Customers', '#'],
  ['💳', 'Payments', '#'],
  ['🔄', 'Returns', '#'],
  ['💸', 'Expenses', '#'],
  ['🤖', 'AI Insights', '#'],
  ['📈', 'Reports', '#'],
].map(([icon, name, href], index) => (
  <Link
    key={name}
    href={href}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 14px',
      marginBottom: '5px',
      borderRadius: '8px',
      background: index === 0 ? '#2563eb' : 'transparent',
      color: index === 0 ? 'white' : '#cbd5e1',
      cursor: 'pointer',
      fontSize: '14px',
      textDecoration: 'none',
    }}
  >
    <span>{icon}</span>
    <span>{name}</span>
  </Link>
))}
          </nav>

          <div
            style={{
              borderTop: '1px solid #334155',
              marginTop: '30px',
              paddingTop: '20px',
            }}
          >
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '8px',
                border: '1px solid #475569',
                background: 'transparent',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              🚪 Logout
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <section style={{ flex: 1, minWidth: 0 }}>
          {/* TOP BAR */}
          <header
            style={{
              height: '75px',
              background: 'white',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 30px',
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: '700',
                }}
              >
                Dashboard
              </h1>
              <p
                style={{
                  margin: '4px 0 0',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Overview of your retail business
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
              }}
            >
              <div
                style={{
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                🔔
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                    fontWeight: '700',
                  }}
                >
                  BO
                </div>

                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>
                    Business Owner
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {email}
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* CONTENT */}
          <div style={{ padding: '30px' }}>
            {/* WELCOME */}
            <div
              style={{
                background:
                  'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                borderRadius: '16px',
                padding: '28px',
                color: 'white',
                marginBottom: '25px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    opacity: 0.85,
                    marginBottom: '7px',
                  }}
                >
                  Welcome back 👋
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: '26px',
                  }}
                >
                  {tenantName || 'RetailPilot Supermarket'}
                </h2>

                <p
                  style={{
                    margin: '8px 0 0',
                    opacity: 0.85,
                    fontSize: '14px',
                  }}
                >
                  Manage your stores, inventory, sales and business insights
                  from one place.
                </p>
              </div>

              <div
                style={{
                  fontSize: '65px',
                  opacity: 0.9,
                }}
              >
                🛒
              </div>
            </div>

            {message && (
              <div
                style={{
                  padding: '14px',
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '10px',
                  marginBottom: '20px',
                }}
              >
                {message}
              </div>
            )}

            {/* KPI CARDS */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '18px',
                marginBottom: '25px',
              }}
            >
              {[
                ['💰', 'Today’s Revenue', '₹0', '+0%'],
                ['🛒', 'Today’s Sales', '0', '+0%'],
                ['📈', 'Total Profit', '₹0', '+0%'],
                ['⚠️', 'Low Stock', '0', 'Action needed'],
              ].map(([icon, title, value, change]) => (
                <div
                  key={title}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '25px' }}>{icon}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#16a34a',
                        background: '#dcfce7',
                        padding: '4px 7px',
                        borderRadius: '20px',
                      }}
                    >
                      {change}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: '15px',
                      fontSize: '13px',
                      color: '#64748b',
                    }}
                  >
                    {title}
                  </div>

                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      marginTop: '5px',
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* LOWER SECTION */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'minmax(0, 2fr) minmax(280px, 1fr)',
                gap: '20px',
              }}
            >
              {/* SALES OVERVIEW */}
              <div
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '25px',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>Sales Overview</h3>
                    <p
                      style={{
                        margin: '5px 0 0',
                        color: '#64748b',
                        fontSize: '13px',
                      }}
                    >
                      Revenue performance
                    </p>
                  </div>

                  <select
                    style={{
                      padding: '7px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                    }}
                  >
                    <option>Last 7 days</option>
                    <option>Last 30 days</option>
                  </select>
                </div>

                {/* SIMPLE CHART PLACEHOLDER */}
                <div
                  style={{
                    height: '230px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-around',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '0 10px',
                  }}
                >
                  {[35, 55, 40, 70, 50, 80, 65].map((height, index) => (
                    <div
                      key={index}
                      style={{
                        width: '8%',
                        height: `${height}%`,
                        background: '#3b82f6',
                        borderRadius: '6px 6px 0 0',
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-around',
                    marginTop: '10px',
                    color: '#94a3b8',
                    fontSize: '11px',
                  }}
                >
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                  <span>Sun</span>
                </div>
              </div>

              {/* AI INSIGHTS */}
              <div
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '18px',
                  }}
                >
                  <span style={{ fontSize: '25px' }}>🤖</span>
                  <div>
                    <h3 style={{ margin: 0 }}>AI Insights</h3>
                    <p
                      style={{
                        margin: '4px 0 0',
                        color: '#64748b',
                        fontSize: '12px',
                      }}
                    >
                      Smart business recommendations
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: '#eff6ff',
                    padding: '15px',
                    borderRadius: '10px',
                    marginBottom: '12px',
                  }}
                >
                  <strong style={{ fontSize: '13px' }}>
                    📦 Inventory
                  </strong>
                  <p
                    style={{
                      margin: '7px 0 0',
                      fontSize: '12px',
                      color: '#475569',
                    }}
                  >
                    AI will identify low-stock products and recommend
                    reorder quantities.
                  </p>
                </div>

                <div
                  style={{
                    background: '#f0fdf4',
                    padding: '15px',
                    borderRadius: '10px',
                    marginBottom: '12px',
                  }}
                >
                  <strong style={{ fontSize: '13px' }}>
                    📈 Profitability
                  </strong>
                  <p
                    style={{
                      margin: '7px 0 0',
                      fontSize: '12px',
                      color: '#475569',
                    }}
                  >
                    Profit analysis will be generated from your live sales
                    data.
                  </p>
                </div>

                <div
                  style={{
                    background: '#fefce8',
                    padding: '15px',
                    borderRadius: '10px',
                  }}
                >
                  <strong style={{ fontSize: '13px' }}>
                    💡 Business Tip
                  </strong>
                  <p
                    style={{
                      margin: '7px 0 0',
                      fontSize: '12px',
                      color: '#475569',
                    }}
                  >
                    AI recommendations will appear here after sales and
                    inventory data is available.
                  </p>
                </div>

                <p
                  style={{
                    fontSize: '10px',
                    color: '#94a3b8',
                    marginTop: '15px',
                  }}
                >
                  AI-generated recommendation. Verify before taking business
                  action.
                </p>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div style={{ marginTop: '25px' }}>
              <h3>Quick Actions</h3>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '15px',
                  marginTop: '15px',
                }}
              >
                {[
                  ['➕', 'Add Product'],
                  ['🏪', 'Add Store'],
                  ['🚚', 'Create Purchase'],
                  ['🛒', 'Open POS'],
                  ['👤', 'Add Customer'],
                  ['📊', 'View Reports'],
                ].map(([icon, text]) => (
                  <button
                    key={text}
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '16px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ fontSize: '20px', marginRight: '8px' }}>
                      {icon}
                    </span>
                    {text}
                  </button>
                ))}
              </div>
            </div>

            {/* FOOTER */}
            <div
              style={{
                textAlign: 'center',
                marginTop: '40px',
                padding: '20px',
                color: '#94a3b8',
                fontSize: '11px',
              }}
            >
              RetailPilot AI • Intelligent Retail Management System
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}