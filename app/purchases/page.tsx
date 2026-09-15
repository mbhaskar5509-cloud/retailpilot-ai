"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  name: string;
};

type Store = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  purchase_price: number;
};

type Purchase = {
  id: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  payment_status: string;
  notes?: string | null;
  suppliers: Supplier | null;
  stores: Store | null;
};

export default function PurchasesPage() {
  const supabase = createClient();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [tenantId, setTenantId] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please login first.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setMessage("Tenant profile not found.");
        setLoading(false);
        return;
      }

      const currentTenantId = profile.tenant_id;
      setTenantId(currentTenantId);

      const [purchaseResult, supplierResult, storeResult, productResult] =
        await Promise.all([
          supabase
            .from("purchases")
            .select(
              `
                id,
                invoice_number,
                purchase_date,
                total_amount,
                payment_status,
                notes,
                suppliers (
                  id,
                  name
                ),
                stores (
                  id,
                  name
                )
              `
            )
            .eq("tenant_id", currentTenantId)
            .order("purchase_date", { ascending: false }),

          supabase
            .from("suppliers")
            .select("id, name")
            .eq("tenant_id", currentTenantId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("stores")
            .select("id, name")
            .eq("tenant_id", currentTenantId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("products")
            .select("id, name, sku, purchase_price")
            .eq("tenant_id", currentTenantId)
            .eq("is_active", true)
            .order("name"),
        ]);

      if (purchaseResult.error) {
        throw purchaseResult.error;
      }

      if (supplierResult.error) {
        throw supplierResult.error;
      }

      if (storeResult.error) {
        throw storeResult.error;
      }

      if (productResult.error) {
        throw productResult.error;
      }

      const purchaseData: Purchase[] = (purchaseResult.data ?? []).map(
        (purchase: any) => ({
          id: purchase.id,
          invoice_number: purchase.invoice_number,
          purchase_date: purchase.purchase_date,
          total_amount: Number(purchase.total_amount ?? 0),
          payment_status: purchase.payment_status,
          notes: purchase.notes ?? null,

          suppliers: Array.isArray(purchase.suppliers)
            ? purchase.suppliers[0] ?? null
            : purchase.suppliers ?? null,

          stores: Array.isArray(purchase.stores)
            ? purchase.stores[0] ?? null
            : purchase.stores ?? null,
        })
      );

      setPurchases(purchaseData);
      setSuppliers((supplierResult.data ?? []) as Supplier[]);
      setStores((storeResult.data ?? []) as Store[]);
      setProducts(
        (productResult.data ?? []).map((product: any) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          purchase_price: Number(product.purchase_price ?? 0),
        }))
      );
    } catch (error) {
      console.error("Purchases load error:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load purchase data."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleProductChange(value: string) {
    setProductId(value);

    const product = products.find((item) => item.id === value);

    if (product) {
      setUnitCost(String(product.purchase_price ?? ""));
    }
  }

  async function addPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantId) {
      setMessage("Tenant not found.");
      return;
    }

    if (!supplierId || !storeId || !productId) {
      setMessage("Please select supplier, store and product.");
      return;
    }

    const qty = Number(quantity);
    const cost = Number(unitCost);

    if (!qty || qty <= 0) {
      setMessage("Enter a valid quantity.");
      return;
    }

    if (!cost || cost <= 0) {
      setMessage("Enter a valid unit cost.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const totalAmount = qty * cost;

      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          tenant_id: tenantId,
          store_id: storeId,
          supplier_id: supplierId,
          invoice_number:
            invoiceNumber.trim() ||
            `PUR-${Date.now().toString().slice(-8)}`,
          purchase_date: new Date().toISOString(),
          total_amount: totalAmount,
          payment_status: paymentStatus,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (purchaseError) {
        throw purchaseError;
      }

      const { error: itemError } = await supabase
        .from("purchase_items")
        .insert({
          tenant_id: tenantId,
          purchase_id: purchase.id,
          product_id: productId,
          quantity: qty,
          unit_cost: cost,
        });

      if (itemError) {
        await supabase
          .from("purchases")
          .delete()
          .eq("id", purchase.id)
          .eq("tenant_id", tenantId);

        throw itemError;
      }

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          tenant_id: tenantId,
          store_id: storeId,
          product_id: productId,
          movement_type: "purchase",
          quantity: qty,
          reference_id: purchase.id,
          notes: `Purchase ${invoiceNumber || purchase.id}`,
        });

      if (movementError) {
        throw movementError;
      }

      setMessage("Purchase added successfully.");

      setInvoiceNumber("");
      setSupplierId("");
      setStoreId("");
      setProductId("");
      setQuantity("");
      setUnitCost("");
      setPaymentStatus("pending");
      setNotes("");

      await loadData();
    } catch (error) {
      console.error("Add purchase error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add purchase."
      );
    } finally {
      setSaving(false);
    }
  }

  const totalPurchases = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.total_amount || 0),
    0
  );

  const pendingPurchases = purchases.filter(
    (purchase) =>
      purchase.payment_status.toLowerCase() === "pending" ||
      purchase.payment_status.toLowerCase() === "unpaid"
  );

  const paidPurchases = purchases.filter(
    (purchase) => purchase.payment_status.toLowerCase() === "paid"
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-600">
              RETAILPILOT AI
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Purchases
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage supplier purchases and incoming inventory.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Refresh Data
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700">
            {message}
          </div>
        )}

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Purchases</p>
            <p className="mt-2 text-2xl font-bold">
              ₹{totalPurchases.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Purchase Orders</p>
            <p className="mt-2 text-2xl font-bold">
              {purchases.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Paid</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {paidPurchases.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {pendingPurchases.length}
            </p>
          </div>
        </div>

        {/* Add Purchase */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Add Purchase</h2>
            <p className="mt-1 text-sm text-slate-500">
              Record a supplier purchase and automatically add stock.
            </p>
          </div>

          <form onSubmit={addPurchase} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Invoice */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Invoice Number
              </label>

              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-1001"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Supplier
              </label>

              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select supplier</option>

                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Store */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Store
              </label>

              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Product
              </label>

              <select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.sku}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Quantity
              </label>

              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Unit Cost */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Unit Cost (₹)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="25"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Payment Status */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Payment Status
              </label>

              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
              </select>
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Notes
              </label>

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional purchase notes"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Purchase"}
              </button>
            </div>
          </form>
        </section>

        {/* Purchase History */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 md:px-6">
            <h2 className="text-xl font-bold">Purchase History</h2>
            <p className="mt-1 text-sm text-slate-500">
              Recent supplier purchase records.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading purchases...
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold text-slate-700">
                No purchases found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Add your first purchase using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Invoice</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Store</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {purchases.map((purchase) => (
                    <tr
                      key={purchase.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {purchase.invoice_number}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {purchase.suppliers?.name ?? "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {purchase.stores?.name ?? "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {new Date(
                          purchase.purchase_date
                        ).toLocaleDateString("en-IN")}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        ₹
                        {Number(
                          purchase.total_amount
                        ).toLocaleString("en-IN")}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            purchase.payment_status.toLowerCase() === "paid"
                              ? "bg-emerald-100 text-emerald-700"
                              : purchase.payment_status.toLowerCase() ===
                                "partial"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {purchase.payment_status}
                        </span>
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
  );
}