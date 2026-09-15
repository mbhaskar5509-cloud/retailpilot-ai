"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  purchase_price: number;
  selling_price: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
};

export default function ProductsPage() {
  const [tenantId, setTenantId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("Pieces");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please login first.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("user_profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();

      if (profileError || !profile?.tenant_id) {
        setMessage("Tenant information not found.");
        setLoading(false);
        return;
      }

      setTenantId(profile.tenant_id);

      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, sku, category, unit, purchase_price, selling_price, reorder_level, is_active, created_at"
        )
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts((data || []) as Product[]);
    } catch (error: any) {
      console.error(error);
      setMessage(
        error?.message || "Failed to load products."
      );
    } finally {
      setLoading(false);
    }
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!tenantId) {
      setMessage("Tenant information is missing.");
      return;
    }

    if (!name.trim() || !sku.trim()) {
      setMessage("Product name and SKU are required.");
      return;
    }

    const purchase = Number(purchasePrice);
    const selling = Number(sellingPrice);
    const reorder = Number(reorderLevel);

    if (
      !Number.isFinite(purchase) ||
      purchase < 0
    ) {
      setMessage("Enter a valid purchase price.");
      return;
    }

    if (
      !Number.isFinite(selling) ||
      selling < 0
    ) {
      setMessage("Enter a valid selling price.");
      return;
    }

    if (
      !Number.isFinite(reorder) ||
      reorder < 0
    ) {
      setMessage("Enter a valid reorder level.");
      return;
    }

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("products")
        .insert({
          tenant_id: tenantId,
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category: category.trim() || null,
          unit: unit.trim() || "Pieces",
          purchase_price: purchase,
          selling_price: selling,
          reorder_level: reorder,
          is_active: true,
        });

      if (error) throw error;

      setMessage("Product added successfully.");

      setName("");
      setSku("");
      setCategory("");
      setUnit("Pieces");
      setPurchasePrice("");
      setSellingPrice("");
      setReorderLevel("10");

      await loadProducts();
    } catch (error: any) {
      console.error(error);

      if (error?.code === "23505") {
        setMessage(
          "This SKU already exists for your business."
        );
      } else {
        setMessage(
          error?.message || "Failed to add product."
        );
      }
    }
  }

  async function toggleProduct(
    product: Product
  ) {
    setMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("products")
        .update({
          is_active: !product.is_active,
        })
        .eq("id", product.id)
        .eq("tenant_id", tenantId);

      if (error) throw error;

      setMessage(
        product.is_active
          ? "Product deactivated."
          : "Product activated."
      );

      await loadProducts();
    } catch (error: any) {
      console.error(error);
      setMessage(
        error?.message || "Failed to update product."
      );
    }
  }

  const activeProducts = products.filter(
    (product) => product.is_active
  ).length;

  const inactiveProducts =
    products.length - activeProducts;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Products
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your supermarket product catalogue,
            pricing and reorder levels.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            {message}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Products
            </p>
            <p className="mt-2 text-2xl font-bold">
              {products.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Active Products
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {activeProducts}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Inactive Products
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-500">
              {inactiveProducts}
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <h2 className="mb-5 text-xl font-semibold">
            Add Product
          </h2>

          <form
            onSubmit={addProduct}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">
                Product Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="e.g. Milk"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                SKU
              </label>

              <input
                type="text"
                value={sku}
                onChange={(e) =>
                  setSku(e.target.value)
                }
                placeholder="e.g. MILK001"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Category
              </label>

              <input
                type="text"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value)
                }
                placeholder="e.g. Dairy"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Unit
              </label>

              <select
                value={unit}
                onChange={(e) =>
                  setUnit(e.target.value)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500"
              >
                <option value="Pieces">Pieces</option>
                <option value="Kg">Kg</option>
                <option value="Grams">Grams</option>
                <option value="Litres">Litres</option>
                <option value="ML">ML</option>
                <option value="Boxes">Boxes</option>
                <option value="Packets">Packets</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Purchase Price
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) =>
                  setPurchasePrice(e.target.value)
                }
                placeholder="₹0.00"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Selling Price
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) =>
                  setSellingPrice(e.target.value)
                }
                placeholder="₹0.00"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Reorder Level
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={reorderLevel}
                onChange={(e) =>
                  setReorderLevel(e.target.value)
                }
                placeholder="10"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 px-5 py-2.5 font-semibold text-white transition hover:bg-slate-800"
              >
                Add Product
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-semibold">
              Product Catalogue
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No products found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-semibold">
                      Product
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      SKU
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Category
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Unit
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Purchase
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Selling
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Reorder
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Status
                    </th>
                    <th className="px-5 py-3 font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-medium">
                        {product.name}
                      </td>

                      <td className="px-5 py-4 font-mono text-xs">
                        {product.sku}
                      </td>

                      <td className="px-5 py-4">
                        {product.category || "—"}
                      </td>

                      <td className="px-5 py-4">
                        {product.unit}
                      </td>

                      <td className="px-5 py-4">
                        ₹
                        {Number(
                          product.purchase_price
                        ).toFixed(2)}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        ₹
                        {Number(
                          product.selling_price
                        ).toFixed(2)}
                      </td>

                      <td className="px-5 py-4">
                        {product.reorder_level}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            product.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {product.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() =>
                            toggleProduct(product)
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            product.is_active
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          }`}
                        >
                          {product.is_active
                            ? "Deactivate"
                            : "Activate"}
                        </button>
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