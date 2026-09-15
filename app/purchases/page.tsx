'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Supplier = {
  id: string
  name: string
}

type Store = {
  id: string
  name: string
}

type Product = {
  id: string
  name: string
  sku: string
  purchase_price: number
}

type Purchase = {
  id: string
  invoice_number: string | null
  purchase_date: string
  total_amount: number
  payment_status: string
  suppliers: { name: string } | null
  stores: { name: string } | null
}

export default function PurchasesPage() {
  const supabase = createClient()

  const [tenantId, setTenantId] = useState('')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])

  const [supplierId, setSupplierId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('pending')

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setMessage('Business profile not found.')
      setLoading(false)
      return
    }

    setTenantId(profile.tenant_id)

    const [supplierResult, storeResult, productResult, purchaseResult] =
      await Promise.all([
        supabase
          .from('suppliers')
          .select('id,name')
          .eq('tenant_id', profile.tenant_id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('stores')
          .select('id,name')
          .eq('tenant_id', profile.tenant_id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('products')
          .select('id,name,sku,purchase_price')
          .eq('tenant_id', profile.tenant_id)
          .eq('is_active', true)
          .order('name'),

        supabase
          .from('purchases')
          .select(
            'id,invoice_number,purchase_date,total_amount,payment_status,suppliers(name),stores(name)'
          )
          .eq('tenant_id', profile.tenant_id)
          .order('created_at', { ascending: false }),
      ])

    setSuppliers(supplierResult.data ?? [])
    setStores(storeResult.data ?? [])
    setProducts(productResult.data ?? [])
    setPurchases(purchaseResult.data ?? [])

    setLoading(false)
  }

  function handleProductChange(id: string) {
    setProductId(id)

    const product = products.find((p) => p.id === id)

    if (product) {
      setUnitCost(Number(product.purchase_price) || 0)
    }
  }

  async function createPurchase(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId || !supplierId || !storeId || !productId) {
      setMessage('Please select supplier, store and product.')
      return
    }

    if (quantity <= 0) {
      setMessage('Quantity must be greater than 0.')
      return
    }

    if (unitCost < 0) {
      setMessage('Unit cost cannot be negative.')
      return
    }

    setSaving(true)
    setMessage('Creating purchase...')

    const totalAmount = quantity * unitCost

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        supplier_id: supplierId,
        invoice_number: invoiceNumber.trim() || null,
        total_amount: totalAmount,
        payment_status: paymentStatus,
      })
      .select('id')
      .single()

    if (purchaseError || !purchase) {
      setMessage(purchaseError?.message || 'Failed to create purchase.')
      setSaving(false)
      return
    }

    const { error: itemError } = await supabase
      .from('purchase_items')
      .insert({
        tenant_id: tenantId,
        purchase_id: purchase.id,
        product_id: productId,
        quantity,
        unit_cost: unitCost,
      })

    if (itemError) {
      await supabase
        .from('purchases')
        .delete()
        .eq('id', purchase.id)
        .eq('tenant_id', tenantId)

      setMessage(itemError.message)
      setSaving(false)
      return
    }

    setMessage('Purchase created successfully! 🎉')

    setSupplierId('')
    setStoreId('')
    setInvoiceNumber('')
    setPaymentStatus('pending')
    setProductId('')
    setQuantity(1)
    setUnitCost(0)

    await loadData()
    setSaving(false)
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '32px',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              fontSize: '32px',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '8px',
            }}
          >
            Purchases
          </h1>

          <p style={{ color: '#64748b' }}>
            Create purchase records and receive goods from suppliers.
          </p>
        </div>

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
              color: '#0f172a',
              marginBottom: '20px',
            }}
          >
            Create Purchase
          </h2>

          {loading ? (
            <p>Loading...</p>
          ) : (
            <form onSubmit={createPurchase}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">Select Supplier *</option>

                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>

                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">Select Store *</option>

                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>

                <input
                  placeholder="Invoice Number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  style={inputStyle}
                />

                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  style={inputStyle}
                >
                  <option value="pending">Payment Pending</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partially Paid</option>
                </select>

                <select
                  value={productId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">Select Product *</option>

                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Number(e.target.value))
                  }
                  style={inputStyle}
                  required
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit Cost"
                  value={unitCost}
                  onChange={(e) =>
                    setUnitCost(Number(e.target.value))
                  }
                  style={inputStyle}
                  required
                />

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                >
                  Total: ₹{(quantity * unitCost).toFixed(2)}
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
                  borderRadius: '10px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Creating...' : '+ Create Purchase'}
              </button>
            </form>
          )}

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
            }}
          >
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#0f172a',
              }}
            >
              Purchase History
            </h2>

            <button
              onClick={loadData}
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

          {purchases.length === 0 ? (
            <p style={{ color: '#64748b' }}>
              No purchases created yet.
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
                      'Invoice',
                      'Supplier',
                      'Store',
                      'Date',
                      'Amount',
                      'Payment',
                    ].map((heading) => (
                      <th key={heading} style={thStyle}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td style={tdStyle}>
                        {purchase.invoice_number || '-'}
                      </td>

                      <td style={tdStyle}>
                        {purchase.suppliers?.name || '-'}
                      </td>

                      <td style={tdStyle}>
                        {purchase.stores?.name || '-'}
                      </td>

                      <td style={tdStyle}>
                        {new Date(
                          purchase.purchase_date
                        ).toLocaleDateString()}
                      </td>

                      <td style={tdStyle}>
                        ₹{Number(purchase.total_amount).toFixed(2)}
                      </td>

                      <td style={tdStyle}>
                        {purchase.payment_status}
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
  background: 'white',
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