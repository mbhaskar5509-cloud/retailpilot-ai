"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  id: string;
  invoice_number: string;
};

type Customer = {
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
  selling_price: number;
};

type ReturnRecord = {
  id: string;
  return_type: string;
  reason: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  sales: Sale | null;
  customers: Customer | null;
};

export default function ReturnsPage() {
  const supabase = createClient();

  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [tenantId, setTenantId] = useState<string | null>(null);

  const [storeId, setStoreId] = useState("");
  const [saleId, setSaleId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [returnType, setReturnType] = useState("customer_return");
  const [reason, setReason] = useState("");

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

      const [
        returnsResult,
        salesResult,
        customersResult,
        storesResult,
        productsResult,
      ] = await Promise.all([
        supabase
          .from("returns")
          .select(
            `
              id,
              return_type,
              reason,
              total_amount,
              status,
              created_at,
              sales (
                id,
                invoice_number
              ),
              customers (
                id,
                name
              )
            `
          )
          .eq("tenant_id", currentTenantId)
          .order("created_at", { ascending: false }),

        supabase
          .from("sales")
          .select("id, invoice_number")
          .eq("tenant_id", currentTenantId)
          .eq("status", "completed")
          .order("sale_date", { ascending: false }),

        supabase
          .from("customers")
          .select("id, name")
          .eq("tenant_id", currentTenantId)
          .order("name"),

        supabase
          .from("stores")
          .select("id, name")
          .eq("tenant_id", currentTenantId)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("products")
          .select("id, name, sku, selling_price")
          .eq("tenant_id", currentTenantId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (returnsResult.error) throw returnsResult.error;
      if (salesResult.error) throw salesResult.error;
      if (customersResult.error) throw customersResult.error;
      if (storesResult.error) throw storesResult.error;
      if (productsResult.error) throw productsResult.error;

      const returnData: ReturnRecord[] = (
        returnsResult.data ?? []
      ).map((record: any) => ({
        id: record.id,
        return_type: record.return_type,
        reason: record.reason ?? null,
        total_amount: Number(record.total_amount ?? 0),
        status: record.status,
        created_at: record.created_at,

        sales: Array.isArray(record.sales)
          ? record.sales[0] ?? null
          : record.sales ?? null,

        customers: Array.isArray(record.customers)
          ? record.customers[0] ?? null
          : record.customers ?? null,
      }));

      setReturns(returnData);
      setSales((salesResult.data ?? []) as Sale[]);
      setCustomers((customersResult.data ?? []) as Customer[]);
      setStores((storesResult.data ?? []) as Store[]);

      setProducts(
        (productsResult.data ?? []).map((product: any) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          selling_price: Number(product.selling_price ?? 0),
        }))
      );
    } catch (error) {
      console.error("Returns load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load returns."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleProductChange(value: string) {
    setProductId(value);

    const product = products.find((item) => item.id === value);

    if (product) {
      setUnitPrice(String(product.selling_price ?? ""));
    }
  }

  async function addReturn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantId) {
      setMessage("Tenant not found.");
      return;
    }

    if (!storeId || !productId) {
      setMessage("Please select store and product.");
      return;
    }

    const qty = Number(quantity);
    const price = Number(unitPrice);

    if (!qty || qty <= 0) {
      setMessage("Enter a valid quantity.");
      return;
    }

    if (!price || price <= 0) {
      setMessage("Enter a valid unit price.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const totalAmount = qty * price;

      const { data: returnRecord, error: returnError } =
        await supabase
          .from("returns")
          .insert({
            tenant_id: tenantId,
            store_id: storeId,
            sale_id: saleId || null,
            customer_id: customerId || null,
            return_type: returnType,
            reason: reason.trim() || null,
            total_amount: totalAmount,
            status: "completed",
          })
          .select("id")
          .single();

      if (returnError) {
        throw returnError;
      }

      const { error: itemError } = await supabase
        .from("return_items")
        .insert({
          tenant_id: tenantId,
          return_id: returnRecord.id,
          product_id: productId,
          quantity: qty,
          unit_price: price,
        });

      if (itemError) {
        throw itemError;
      }

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          tenant_id: tenantId,
          store_id: storeId,
          product_id: productId,
          movement_type: "customer_return",
          quantity: qty,
          reference_id: returnRecord.id,
          notes: reason.trim() || "Customer return",
        });

      if (movementError) {
        throw movementError;
      }

      setMessage("Return added successfully.");

      setStoreId("");
      setSaleId("");
      setCustomerId("");
      setProductId("");
      setQuantity("");
      setUnitPrice("");
      setReturnType("customer_return");
      setReason("");

      await loadData();
    } catch (error) {
      console.error("Add return error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add return."
      );
    } finally {
      setSaving(false);
    }
  }

  const totalReturns = returns.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0
  );

  const completedReturns = returns.filter(
    (item) => item.status.toLowerCase() === "completed"
  );

  const pendingReturns = returns.filter(
    (item) => item.status.toLowerCase() === "pending"
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
              Returns
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage customer returns and returned inventory.
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
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

        {/* KPI */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Return Value</p>
            <p className="mt-2 text-2xl font-bold">
              ₹{totalReturns.toLocaleString("en-IN")}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Returns</p>
            <p className="mt-2 text-2xl font-bold">
              {returns.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Completed</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {completedReturns.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pending</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {pendingReturns.length}
            </p>
          </div>
        </div>

        {/* Add Return */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Create Return</h2>

            <p className="mt-1 text-sm text-slate-500">
              Record a customer return and add the returned quantity back to inventory.
            </p>
          </div>

          <form
            onSubmit={addReturn}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
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

            {/* Sale */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Sale Invoice
              </label>

              <select
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Optional</option>

                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.invoice_number}
                  </option>
                ))}
              </select>
            </div>

            {/* Customer */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Customer
              </label>

              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Optional</option>

                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
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
                placeholder="1"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Unit Price */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Unit Price (₹)
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="30"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Return Type */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Return Type
              </label>

              <select
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="customer_return">
                  Customer Return
                </option>
                <option value="supplier_return">
                  Supplier Return
                </option>
              </select>
            </div>

            {/* Reason */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Reason
              </label>

              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Damaged, wrong product, customer changed mind..."
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Return"}
              </button>
            </div>
          </form>
        </section>

        {/* History */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 md:px-6">
            <h2 className="text-xl font-bold">Return History</h2>

            <p className="mt-1 text-sm text-slate-500">
              Recent return transactions.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading returns...
            </div>
          ) : returns.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold text-slate-700">
                No returns found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create your first return using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Invoice</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Type</th>
                    <th className="px-5 py-4">Amount</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {returns.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 text-slate-600">
                        {new Date(item.created_at).toLocaleDateString(
                          "en-IN"
                        )}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        {item.sales?.invoice_number ?? "—"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {item.customers?.name ?? "Walk-in Customer"}
                      </td>

                      <td className="px-5 py-4 capitalize text-slate-600">
                        {item.return_type.replaceAll("_", " ")}
                      </td>

                      <td className="px-5 py-4 font-semibold text-slate-900">
                        ₹
                        {Number(item.total_amount).toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            item.status.toLowerCase() === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.status}
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