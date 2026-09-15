'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Product = {
  id: string
  name: string
  sku: string
  reorder_level: number
}

type Store = {
  id: string
  name: string
}

type Movement = {
  id: string
  movement_type: string
  quantity: number
  notes: string | null
  created_at: string
  products: { name: string; sku: string } | null
  stores: { name: string } | null
}

export default function InventoryPage() {
  const supabase = createClient()

  const [tenantId, setTenantId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [stock, setStock] = useState<Record<string, number>>({})

  const [productId, setProductId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [movementType, setMovementType] = useState('adjustment')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadInventory()
  }, [])

  async function loadInventory() {
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

    const [productsResult, storesResult, movementsResult] =
      await Promise.all([
        supabase
          .from('products')
          .select('id,name,sku,reorder_level')
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
          .from('stock_movements')
          .select(
            'id,movement_type,quantity,notes,created_at,products(name,sku),stores(name)'
          )
          .eq('tenant_id', profile.tenant_id)
          .order('created_at', { ascending: false }),
      ])

    setProducts(productsResult.data ?? [])
    setStores(storesResult.data ?? [])
    setMovements(movementsResult.data ?? [])

    calculateStock(movementsResult.data ?? [])

    setLoading(false)
  }

  function calculateStock(data: Movement[]) {
    const result: Record<string, number> = {}

    for (const movement of data) {
      const productId = movement.products
        ? products.find(
            (p) => p.name === movement.products?.name
          )?.id
        : null

      if (!productId) continue

      if (!result[productId]) {
        result[productId] = 0
      }

      result[productId] += movement.quantity
    }

    setStock(result)
  }

  async function addMovement(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId || !productId || !storeId) {
      setMessage('Please select product and store.')
      return
    }

    if (quantity === 0) {
      setMessage('Quantity cannot be zero.')
      return
    }

    setSaving(true)
    setMessage('Saving stock movement...')

    let finalQuantity = quantity

    if (
      movementType === 'sale' ||
      movementType === 'supplier_return' ||
      movementType === 'damage' ||
      movementType === 'transfer_out'
    ) {
      finalQuantity = -Math.abs(quantity)
    } else {
      finalQuantity = Math.abs(quantity)
    }

    const { error } = await supabase
      .from('stock_movements')
      .insert({
        tenant_id: tenantId,
        store_id: storeId,
        product_id: productId,
        movement_type: movementType,
        quantity: finalQuantity,
        notes: notes.trim() || null,
      })

    if (error) {
      setMessage(error.message)
      setSaving(false)
      return
    }

    setProductId('')
    setStoreId('')
    setMovementType('adjustment')
    setQuantity(1)
    setNotes('')

    setMessage('Stock movement added successfully! 🎉')

    await loadInventory()

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
            Inventory
          </h1>

          <p style={{ color: '#64748b' }}>
            Track stock using an immutable movement ledger.
          </p>
        </div>

        {/* Stock Movement */}
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
            Add Stock Movement
          </h2>

          {loading ? (
            <p>Loading inventory...</p>
          ) : (
            <form onSubmit={addMovement}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '16px',
                }}
              >
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
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

                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="purchase">Purchase +</option>
                  <option value="sale">Sale -</option>
                  <option value="customer_return">
                    Customer Return +
                  </option>
                  <option value="supplier_return">
                    Supplier Return -
                  </option>
                  <option value="damage">Damage -</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="transfer_in">Transfer In +</option>
                  <option value="transfer_out">Transfer Out -</option>
                </select>

                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Number(e.target.value))
                  }
                  min="1"
                  style={inputStyle}
                  required
                />

                <input
                  placeholder="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={inputStyle}
                />
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
                {saving ? 'Saving...' : '+ Add Movement'}
              </button>
            </form>
          )}

          {message && (
            <p style={{ marginTop: '16px', color: '#475569' }}>
              {message}
            </p>
          )}
        </section>

        {/* Stock Summary */}
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
            Stock Summary
          </h2>

          {products.length === 0 ? (
            <p style={{ color: '#64748b' }}>
              No products available.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '650px',
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>Current Stock</th>
                    <th style={thStyle}>Reorder Level</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((product) => {
                    const currentStock = stock[product.id] ?? 0
                    const lowStock =
                      currentStock <= product.reorder_level

                    return (
                      <tr key={product.id}>
                        <td style={tdStyle}>
                          <strong>{product.name}</strong>
                        </td>

                        <td style={tdStyle}>{product.sku}</td>

                        <td style={tdStyle}>
                          {currentStock}
                        </td>

                        <td style={tdStyle}>
                          {product.reorder_level}
                        </td>

                        <td style={tdStyle}>
                          {lowStock ? '⚠️ Low Stock' : '✅ Healthy'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Movement Ledger */}
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
              Stock Movement Ledger
            </h2>

            <button
              onClick={loadInventory}
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

          {movements.length === 0 ? (
            <p style={{ color: '#64748b' }}>
              No stock movements yet.
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
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>Store</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Quantity</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Notes</th>
                  </tr>
                </thead>

                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td style={tdStyle}>
                        {movement.products?.name || '-'}
                      </td>

                      <td style={tdStyle}>
                        {movement.stores?.name || '-'}
                      </td>

                      <td style={tdStyle}>
                        {movement.movement_type}
                      </td>

                      <td style={tdStyle}>
                        {movement.quantity > 0
                          ? `+${movement.quantity}`
                          : movement.quantity}
                      </td>

                      <td style={tdStyle}>
                        {new Date(
                          movement.created_at
                        ).toLocaleString()}
                      </td>

                      <td style={tdStyle}>
                        {movement.notes || '-'}
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