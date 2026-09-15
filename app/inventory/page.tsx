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

    if (productsResult.error) {
      setMessage(productsResult.error.message)
      setLoading(false)
      return
    }

    if (storesResult.error) {
      setMessage(storesResult.error.message)
      setLoading(false)
      return
    }

    if (movementsResult.error) {
      setMessage(movementsResult.error.message)
      setLoading(false)
      return
    }

    const productData = (productsResult.data ?? []) as Product[]
    const storeData = (storesResult.data ?? []) as Store[]

    const movementData: Movement[] = (movementsResult.data ?? []).map(
      (movement) => {
        const productRelation = Array.isArray(movement.products)
          ? movement.products[0] ?? null
          : movement.products ?? null

        const storeRelation = Array.isArray(movement.stores)
          ? movement.stores[0] ?? null
          : movement.stores ?? null

        return {
          id: movement.id,
          movement_type: movement.movement_type,
          quantity: Number(movement.quantity ?? 0),
          notes: movement.notes ?? null,
          created_at: movement.created_at,
          products: productRelation,
          stores: storeRelation,
        }
      }
    )

    setProducts(productData)
    setStores(storeData)
    setMovements(movementData)

    calculateStock(movementData, productData)

    setLoading(false)
  }

  function calculateStock(
    data: Movement[],
    productList: Product[]
  ) {
    const result: Record<string, number> = {}

    for (const movement of data) {
      if (!movement.products) continue

      const matchedProduct = productList.find(
        (product) => product.sku === movement.products?.sku
      )

      if (!matchedProduct) continue

      if (result[matchedProduct.id] === undefined) {
        result[matchedProduct.id] = 0
      }

      result[matchedProduct.id] += Number(movement.quantity || 0)
    }

    setStock(result)
  }

  async function addMovement(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId || !productId || !storeId) {
      setMessage('Please select product and store.')
      return
    }

    if (quantity <= 0) {
      setMessage('Quantity must be greater than zero.')
      return
    }

    setSaving(true)
    setMessage('Saving stock movement...')

    let finalQuantity = Math.abs(quantity)

    if (
      movementType === 'sale' ||
      movementType === 'supplier_return' ||
      movementType === 'damage' ||
      movementType === 'transfer_out'
    ) {
      finalQuantity = -Math.abs(quantity)
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

    setMessage('Stock movement added successfully!')

    await loadInventory()

    setSaving(false)
  }

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
              background: '#dcfce7',
              color: '#166534',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '10px',
            }}
          >
            INVENTORY MANAGEMENT
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            Inventory
          </h1>

          <p
            style={{
              marginTop: '8px',
              color: '#475569',
              fontSize: '15px',
            }}
          >
            Track stock using an immutable movement ledger.
          </p>
        </div>

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
            Add Stock Movement
          </h2>

          {loading ? (
            <div
              style={{
                padding: '20px',
                color: '#475569',
              }}
            >
              Loading inventory...
            </div>
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
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px 22px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : '+ Add Movement'}
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
            Stock Summary
          </h2>

          {products.length === 0 ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '12px',
                color: '#475569',
              }}
            >
              No products available.
            </div>
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
                      product.reorder_level > 0 &&
                      currentStock <= product.reorder_level

                    return (
                      <tr key={product.id}>
                        <td style={tdStyle}>
                          <strong style={{ color: '#0f172a' }}>
                            {product.name}
                          </strong>
                        </td>

                        <td style={tdStyle}>{product.sku}</td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          {currentStock}
                        </td>

                        <td style={tdStyle}>
                          {product.reorder_level}
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '5px 10px',
                              borderRadius: '999px',
                              background: lowStock
                                ? '#fee2e2'
                                : '#dcfce7',
                              color: lowStock
                                ? '#991b1b'
                                : '#166534',
                              fontWeight: 700,
                              fontSize: '12px',
                            }}
                          >
                            {lowStock ? 'Low Stock' : 'Healthy'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
                Stock Movement Ledger
              </h2>

              <p
                style={{
                  margin: '5px 0 0',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                Complete stock movement history
              </p>
            </div>

            <button
              type="button"
              onClick={loadInventory}
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

          {movements.length === 0 ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                background: '#f8fafc',
                borderRadius: '12px',
                color: '#475569',
              }}
            >
              No stock movements yet.
            </div>
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
                        <strong style={{ color: '#0f172a' }}>
                          {movement.products?.name || '-'}
                        </strong>
                      </td>

                      <td style={tdStyle}>
                        {movement.stores?.name || '-'}
                      </td>

                      <td style={tdStyle}>
                        {movement.movement_type}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                          color:
                            movement.quantity > 0
                              ? '#166534'
                              : '#dc2626',
                        }}
                      >
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