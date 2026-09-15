"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Store = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  sku: string;
};

type Transfer = {
  id: string;
  from_store_id: string;
  to_store_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  from_store: Store | null;
  to_store: Store | null;
};

type TransferItem = {
  id: string;
  product_id: string;
  quantity: number;
};

export default function StockTransfersPage() {
  const supabase = createClient();

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [tenantId, setTenantId] = useState<string | null>(null);

  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
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

      const [transferResult, storeResult, productResult] =
        await Promise.all([
          supabase
            .from("stock_transfers")
            .select(
              `
                id,
                from_store_id,
                to_store_id,
                status,
                notes,
                created_at,
                from_store:stores!stock_transfers_from_store_id_fkey (
                  id,
                  name
                ),
                to_store:stores!stock_transfers_to_store_id_fkey (
                  id,
                  name
                )
              `
            )
            .eq("tenant_id", currentTenantId)
            .order("created_at", { ascending: false }),

          supabase
            .from("stores")
            .select("id, name")
            .eq("tenant_id", currentTenantId)
            .eq("is_active", true)
            .order("name"),

          supabase
            .from("products")
            .select("id, name, sku")
            .eq("tenant_id", currentTenantId)
            .eq("is_active", true)
            .order("name"),
        ]);

      if (transferResult.error) {
        throw transferResult.error;
      }

      if (storeResult.error) {
        throw storeResult.error;
      }

      if (productResult.error) {
        throw productResult.error;
      }

      const transferData: Transfer[] = (
        transferResult.data ?? []
      ).map((transfer: any) => ({
        id: transfer.id,
        from_store_id: transfer.from_store_id,
        to_store_id: transfer.to_store_id,
        status: transfer.status,
        notes: transfer.notes ?? null,
        created_at: transfer.created_at,

        from_store: Array.isArray(transfer.from_store)
          ? transfer.from_store[0] ?? null
          : transfer.from_store ?? null,

        to_store: Array.isArray(transfer.to_store)
          ? transfer.to_store[0] ?? null
          : transfer.to_store ?? null,
      }));

      setTransfers(transferData);
      setStores((storeResult.data ?? []) as Store[]);
      setProducts((productResult.data ?? []) as Product[]);
    } catch (error) {
      console.error("Stock transfers load error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load stock transfers."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!tenantId) {
      setMessage("Tenant not found.");
      return;
    }

    if (!fromStoreId || !toStoreId) {
      setMessage("Please select both stores.");
      return;
    }

    if (fromStoreId === toStoreId) {
      setMessage("From Store and To Store must be different.");
      return;
    }

    if (!productId) {
      setMessage("Please select a product.");
      return;
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      setMessage("Enter a valid quantity.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { data: transfer, error: transferError } = await supabase
        .from("stock_transfers")
        .insert({
          tenant_id: tenantId,
          from_store_id: fromStoreId,
          to_store_id: toStoreId,
          status: "requested",
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (transferError) {
        throw transferError;
      }

      const { error: itemError } = await supabase
        .from("stock_transfer_items")
        .insert({
          tenant_id: tenantId,
          transfer_id: transfer.id,
          product_id: productId,
          quantity: qty,
        });

      if (itemError) {
        await supabase
          .from("stock_transfers")
          .delete()
          .eq("id", transfer.id)
          .eq("tenant_id", tenantId);

        throw itemError;
      }

      setMessage("Stock transfer created successfully.");

      setFromStoreId("");
      setToStoreId("");
      setProductId("");
      setQuantity("");
      setNotes("");

      await loadData();
    } catch (error) {
      console.error("Create transfer error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create stock transfer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateTransferStatus(
    transfer: Transfer,
    newStatus: string
  ) {
    if (!tenantId) return;

    setMessage("");

    try {
      const { error } = await supabase
        .from("stock_transfers")
        .update({
          status: newStatus,
        })
        .eq("id", transfer.id)
        .eq("tenant_id", tenantId);

      if (error) {
        throw error;
      }

      /*
       * Inventory ledger updates are intentionally handled only
       * when the transfer reaches "received".
       */
      if (newStatus === "received") {
        const { data: items, error: itemsError } = await supabase
          .from("stock_transfer_items")
          .select("id, product_id, quantity")
          .eq("tenant_id", tenantId)
          .eq("transfer_id", transfer.id);

        if (itemsError) {
          throw itemsError;
        }

        const transferItems = (items ?? []) as TransferItem[];

        for (const item of transferItems) {
          const { error: outError } = await supabase
            .from("stock_movements")
            .insert({
              tenant_id: tenantId,
              store_id: transfer.from_store_id,
              product_id: item.product_id,
              movement_type: "transfer_out",
              quantity: -Math.abs(Number(item.quantity)),
              reference_id: transfer.id,
              notes: "Stock transfer out",
            });

          if (outError) {
            throw outError;
          }

          const { error: inError } = await supabase
            .from("stock_movements")
            .insert({
              tenant_id: tenantId,
              store_id: transfer.to_store_id,
              product_id: item.product_id,
              movement_type: "transfer_in",
              quantity: Math.abs(Number(item.quantity)),
              reference_id: transfer.id,
              notes: "Stock transfer in",
            });

          if (inError) {
            throw inError;
          }
        }
      }

      setMessage(`Transfer status updated to ${newStatus}.`);

      await loadData();
    } catch (error) {
      console.error("Transfer status error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update transfer status."
      );
    }
  }

  const totalTransfers = transfers.length;

  const requestedCount = transfers.filter(
    (item) => item.status === "requested"
  ).length;

  const approvedCount = transfers.filter(
    (item) => item.status === "approved"
  ).length;

  const receivedCount = transfers.filter(
    (item) => item.status === "received"
  ).length;

  function getNextStatus(status: string) {
    switch (status) {
      case "draft":
        return "requested";
      case "requested":
        return "approved";
      case "approved":
        return "dispatched";
      case "dispatched":
        return "received";
      default:
        return null;
    }
  }

  function getStatusLabel(status: string) {
    return status.replaceAll("_", " ");
  }

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
              Stock Transfers
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Move inventory safely between your stores.
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

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Transfers</p>
            <p className="mt-2 text-2xl font-bold">{totalTransfers}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Requested</p>
            <p className="mt-2 text-2xl font-bold text-amber-600">
              {requestedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Approved</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">
              {approvedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Received</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {receivedCount}
            </p>
          </div>
        </div>

        {/* Create Transfer */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold">Create Stock Transfer</h2>

            <p className="mt-1 text-sm text-slate-500">
              Create a transfer request between two stores.
            </p>
          </div>

          <form
            onSubmit={createTransfer}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            {/* From Store */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                From Store
              </label>

              <select
                value={fromStoreId}
                onChange={(e) => setFromStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select source store</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            {/* To Store */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                To Store
              </label>

              <select
                value={toStoreId}
                onChange={(e) => setToStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select destination store</option>

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
                onChange={(e) => setProductId(e.target.value)}
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

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Notes
              </label>

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional transfer notes"
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
                {saving ? "Creating..." : "Create Transfer"}
              </button>
            </div>
          </form>
        </section>

        {/* Transfer History */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 md:px-6">
            <h2 className="text-xl font-bold">Transfer History</h2>

            <p className="mt-1 text-sm text-slate-500">
              Track every store-to-store inventory movement.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading transfers...
            </div>
          ) : transfers.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold text-slate-700">
                No stock transfers found
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create your first transfer using the form above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">From</th>
                    <th className="px-5 py-4">To</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Notes</th>
                    <th className="px-5 py-4">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {transfers.map((transfer) => {
                    const nextStatus = getNextStatus(transfer.status);

                    return (
                      <tr
                        key={transfer.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4 text-slate-600">
                          {new Date(
                            transfer.created_at
                          ).toLocaleDateString("en-IN")}
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-900">
                          {transfer.from_store?.name ?? "—"}
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-900">
                          {transfer.to_store?.name ?? "—"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                              transfer.status === "received"
                                ? "bg-emerald-100 text-emerald-700"
                                : transfer.status === "approved"
                                ? "bg-blue-100 text-blue-700"
                                : transfer.status === "dispatched"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {getStatusLabel(transfer.status)}
                          </span>
                        </td>

                        <td className="max-w-[220px] truncate px-5 py-4 text-slate-600">
                          {transfer.notes ?? "—"}
                        </td>

                        <td className="px-5 py-4">
                          {nextStatus ? (
                            <button
                              onClick={() =>
                                updateTransferStatus(
                                  transfer,
                                  nextStatus
                                )
                              }
                              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              Mark {getStatusLabel(nextStatus)}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-600">
                              Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}