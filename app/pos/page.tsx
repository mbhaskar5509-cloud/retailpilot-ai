'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string
  selling_price: number
}

type CartItem = Product & {
  quantity: number
}

export default function POSPage() {
  const supabase = createClient()

  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [message, setMessage] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPOS()
  }, [])

  async function loadPOS() {
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

    const { data: stores } = await supabase
      .from('stores')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .limit(1)

    if (stores && stores.length > 0) {
      setStoreId(stores[0].id)
    }

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('id, name, sku, selling_price')
      .eq('tenant_id', profile.tenant_id)
      .eq('is_active', true)
      .order('name')

    if (productError) {
      setMessage(productError.message)
    } else {
      setProducts(productData ?? [])
    }

    setLoading(false)
  }

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...current, { ...product, quantity: 1 }]
    })

    setMessage('')
  }

  function updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.id !== id))
      return
    }

    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, quantity } : item
      )
    )
  }

  function removeFromCart(id: string) {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  const total = cart.reduce(
    (sum, item) => sum + Number(item.selling_price) * item.quantity,
    0
  )

  async function completeSale() {
    if (!tenantId) {
      setMessage('Tenant not found.')
      return
    }

    if (!storeId) {
      setMessage('Please create an active store first.')
      return
    }

    if (cart.length === 0) {
      setMessage('Cart is empty.')
      return
    }

    setMessage('Processing sale...')

    const invoiceNumber = `INV-${Date.now()}`

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        invoice_number: invoiceNumber,
        subtotal: total,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: total,
        status: 'completed',
      })
      .select()
      .single()

    if (saleError || !sale) {
      setMessage(saleError?.message ?? 'Sale creation failed.')
      return
    }

    const saleItems = cart.map((item) => ({
      tenant_id: tenantId,
      sale_id: sale.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: Number(item.selling_price),
    }))

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      setMessage(itemsError.message)
      return
    }

    const movements = cart.map((item) => ({
      tenant_id: tenantId,
      store_id: storeId,
      product_id: item.id,
      movement_type: 'sale',
      quantity: -item.quantity,
      reference_id: sale.id,
      notes: `POS Sale ${invoiceNumber}`,
    }))

    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert(movements)

    if (movementError) {
      setMessage(movementError.message)
      return
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        tenant_id: tenantId,
        sale_id: sale.id,
        payment_method: paymentMethod,
        amount: total,
        payment_status: 'paid',
        transaction_reference: invoiceNumber,
      })

    if (paymentError) {
      setMessage(paymentError.message)
      return
    }

    setCart([])
    setMessage(`Sale completed successfully! Invoice: ${invoiceNumber}`)
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          padding: '40px',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <h2 style={{ color: '#0f172a' }}>Loading POS...</h2>
      </main>
    )
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
          maxWidth: '1400px',
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
            POS Sales
          </h1>

          <p
            style={{
              marginTop: '8px',
              color: '#64748b',
              fontSize: '15px',
            }}
          >
            Search products, add them to the cart and complete sales.
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

        {/* Search */}
        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Search product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontSize: '15px',
              outline: 'none',
            }}
          />
        </div>

        {/* Main POS Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Products */}
          <section>
            <div
              style={{
                backgroundColor: '#ffffff',
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
                  marginBottom: '18px',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: '20px',
                    color: '#0f172a',
                  }}
                >
                  Products
                </h2>

                <span
                  style={{
                    color: '#64748b',
                    fontSize: '14px',
                  }}
                >
                  {filteredProducts.length} available
                </span>
              </div>

              {filteredProducts.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#64748b',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#334155',
                    }}
                  >
                    No products found
                  </p>

                  <p
                    style={{
                      marginTop: '8px',
                      fontSize: '14px',
                    }}
                  >
                    Add a product from the Products page first.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(190px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '18px',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 8px',
                          fontSize: '17px',
                          lineHeight: '1.4',
                          color: '#0f172a',
                          fontWeight: '700',
                        }}
                      >
                        {product.name}
                      </h3>

                      <p
                        style={{
                          margin: '0 0 10px',
                          fontSize: '13px',
                          color: '#64748b',
                        }}
                      >
                        SKU: {product.sku}
                      </p>

                      <p
                        style={{
                          margin: '0 0 16px',
                          fontSize: '20px',
                          fontWeight: '700',
                          color: '#0f172a',
                        }}
                      >
                        ₹{Number(product.selling_price).toFixed(2)}
                      </p>

                      <button
                        onClick={() => addToCart(product)}
                        style={{
                          width: '100%',
                          padding: '11px 12px',
                          border: 'none',
                          borderRadius: '8px',
                          backgroundColor: '#0f172a',
                          color: '#ffffff',
                          fontSize: '14px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Cart */}
          <section
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '20px',
            }}
          >
            <h2
              style={{
                margin: '0 0 18px',
                fontSize: '20px',
                color: '#0f172a',
              }}
            >
              Cart
            </h2>

            {cart.length === 0 ? (
              <div
                style={{
                  padding: '30px 10px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  Your cart is empty
                </p>

                <p
                  style={{
                    marginTop: '8px',
                    fontSize: '14px',
                    color: '#64748b',
                  }}
                >
                  Add products to start a sale.
                </p>
              </div>
            ) : (
              <>
                {cart.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '14px 0',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#0f172a',
                          }}
                        >
                          {item.name}
                        </p>

                        <p
                          style={{
                            margin: '5px 0 0',
                            fontSize: '13px',
                            color: '#64748b',
                          }}
                        >
                          ₹{Number(item.selling_price).toFixed(2)} each
                        </p>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                        }}
                      >
                        Remove
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginTop: '12px',
                      }}
                    >
                      <label
                        style={{
                          fontSize: '13px',
                          color: '#475569',
                        }}
                      >
                        Qty
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(
                            item.id,
                            Number(e.target.value)
                          )
                        }
                        style={{
                          width: '70px',
                          padding: '8px',
                          border: '1px solid #cbd5e1',
                          borderRadius: '7px',
                          color: '#0f172a',
                          backgroundColor: '#ffffff',
                          textAlign: 'center',
                        }}
                      />

                      <strong
                        style={{
                          marginLeft: 'auto',
                          color: '#0f172a',
                        }}
                      >
                        ₹
                        {(
                          Number(item.selling_price) *
                          item.quantity
                        ).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '20px 0',
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#0f172a',
                  }}
                >
                  <span>Total</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>

                {/* Payment */}
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#334155',
                  }}
                >
                  Payment Method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '11px',
                    marginBottom: '14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                  }}
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                </select>

                <button
                  onClick={completeSale}
                  style={{
                    width: '100%',
                    padding: '14px',
                    border: 'none',
                    borderRadius: '9px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Complete Sale
                </button>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Mobile responsive fix */}
      <style jsx>{`
        @media (max-width: 800px) {
          main {
            padding: 16px !important;
          }

          div[style*='minmax(0, 2fr)'] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  )
}