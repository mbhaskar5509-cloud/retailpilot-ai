"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  purchase_price: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
};

type CartItem = {
  product: Product;
  quantity: number;
};

export default function POSPage() {
  const [tenantId, setTenantId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<
    { id: string; name: string }[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPOSData();
  }, []);

  async function loadPOSData() {
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

      const tenant = profile.tenant_id;
      setTenantId(tenant);

      const [
        storesResult,
        productsResult,
        customersResult,
      ] = await Promise.all([
        supabase
          .from("stores")
          .select("id, name")
          .eq("tenant_id", tenant)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("products")
          .select(
            "id, name, sku, selling_price, purchase_price"
          )
          .eq("tenant_id", tenant)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("customers")
          .select("id, name, phone")
          .eq("tenant_id", tenant)
          .order("name"),
      ]);

      if (storesResult.error) throw storesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (customersResult.error) throw customersResult.error;

      const storeData = storesResult.data || [];

      setStores(storeData);
      setProducts(
        (productsResult.data || []) as Product[]
      );
      setCustomers(
        (customersResult.data || []) as Customer[]
      );

      if (storeData.length > 0) {
        setStoreId(storeData[0].id);
      }
    } catch (error: any) {
      console.error(error);
      setMessage(
        error?.message || "Failed to load POS data."
      );
    } finally {
      setLoading(false);
    }
  }

  function addToCart() {
    setMessage("");

    if (!selectedProduct) {
      setMessage("Please select a product.");
      return;
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      setMessage("Quantity must be greater than 0.");
      return;
    }

    const product = products.find(
      (item) => item.id === selectedProduct
    );

    if (!product) {
      setMessage("Product not found.");
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + qty,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          product,
          quantity: qty,
        },
      ];
    });

    setSelectedProduct("");
    setQuantity("1");
  }

  function updateQuantity(
    productId: string,
    newQuantity: number
  ) {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity: newQuantity,
            }
          : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((currentCart) =>
      currentCart.filter(
        (item) => item.product.id !== productId
      )
    );
  }

  function clearCart() {
    setCart([]);
    setMessage("");
  }

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      Number(item.product.selling_price) *
        item.quantity,
    0
  );

  const discountAmount = Math.max(
    0,
    Number(discount) || 0
  );

  const taxAmount = Math.max(0, Number(tax) || 0);

  const totalAmount = Math.max(
    0,
    subtotal - discountAmount + taxAmount
  );

  async function completeSale() {
    setMessage("");

    if (!tenantId) {
      setMessage("Tenant information is missing.");
      return;
    }

    if (!storeId) {
      setMessage("Please select a store.");
      return;
    }

    if (cart.length === 0) {
      setMessage("Cart is empty.");
      return;
    }

    setProcessing(true);

    try {
      const supabase = createClient();

      const invoiceNumber =
        "INV-" +
        Date.now().toString().slice(-10);

      const { data: sale, error: saleError } =
        await supabase
          .from("sales")
          .insert({
            tenant_id: tenantId,
            store_id: storeId,
            customer_id: customerId || null,
            invoice_number: invoiceNumber,
            sale_date: new Date().toISOString(),
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            status: "completed",
          })
          .select("id")
          .single();

      if (saleError) throw saleError;

      const saleItems = cart.map((item) => ({
        tenant_id: tenantId,
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: Number(
          item.product.selling_price
        ),
      }));

      const { error: itemsError } =
        await supabase
          .from("sale_items")
          .insert(saleItems);

      if (itemsError) throw itemsError;

      const stockMovements = cart.map((item) => ({
        tenant_id: tenantId,
        store_id: storeId,
        product_id: item.product.id,
        movement_type: "sale",
        quantity: -Math.abs(item.quantity),
        reference_id: sale.id,
        notes: `POS sale ${invoiceNumber}`,
      }));

      const { error: stockError } =
        await supabase
          .from("stock_movements")
          .insert(stockMovements);

      if (stockError) throw stockError;

      const { error: paymentError } =
        await supabase
          .from("payments")
          .insert({
            tenant_id: tenantId,
            sale_id: sale.id,
            payment_method: paymentMethod,
            amount: totalAmount,
            payment_status: "paid",
            transaction_reference:
              invoiceNumber,
            paid_at: new Date().toISOString(),
          });

      if (paymentError) throw paymentError;

      setMessage(
        `Sale completed successfully. Invoice: ${invoiceNumber}`
      );

      setCart([]);
      setCustomerId("");
      setPaymentMethod("cash");
      setDiscount("0");
      setTax("0");

      await loadPOSData();
    } catch (error: any) {
      console.error(error);
      setMessage(
        error?.message || "Failed to complete sale."
      );
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            Loading POS...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            POS Sales
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create sales, manage cart items and record payments.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="mb-5 text-xl font-semibold">
              Add Products
            </h2>

            <div className="grid gap-4 md:grid-cols-[1fr_160px_140px]">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Product
                </label>

                <select
                  value={selectedProduct}
                  onChange={(e) =>
                    setSelectedProduct(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500"
                >
                  <option value="">
                    Select product
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.name} ({product.sku}) — ₹
                      {Number(
                        product.selling_price
                      ).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={addToCart}
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 font-semibold text-white hover:bg-slate-800"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="px-3 py-3">
                      Product
                    </th>
                    <th className="px-3 py-3">
                      Price
                    </th>
                    <th className="px-3 py-3">
                      Quantity
                    </th>
                    <th className="px-3 py-3">
                      Total
                    </th>
                    <th className="px-3 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {cart.map((item) => (
                    <tr key={item.product.id}>
                      <td className="px-3 py-4 font-medium">
                        {item.product.name}
                        <div className="text-xs text-slate-400">
                          {item.product.sku}
                        </div>
                      </td>

                      <td className="px-3 py-4">
                        ₹
                        {Number(
                          item.product.selling_price
                        ).toFixed(2)}
                      </td>

                      <td className="px-3 py-4">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.product.id,
                              Number(e.target.value)
                            )
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1.5"
                        />
                      </td>

                      <td className="px-3 py-4 font-semibold">
                        ₹
                        {(
                          Number(
                            item.product.selling_price
                          ) * item.quantity
                        ).toFixed(2)}
                      </td>

                      <td className="px-3 py-4">
                        <button
                          onClick={() =>
                            removeFromCart(
                              item.product.id
                            )
                          }
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}

                  {cart.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-10 text-center text-slate-400"
                      >
                        Cart is empty. Add products to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Clear Cart
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 className="mb-5 text-xl font-semibold">
              Checkout
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Store
                </label>

                <select
                  value={storeId}
                  onChange={(e) =>
                    setStoreId(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                >
                  <option value="">
                    Select store
                  </option>

                  {stores.map((store) => (
                    <option
                      key={store.id}
                      value={store.id}
                    >
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Customer
                </label>

                <select
                  value={customerId}
                  onChange={(e) =>
                    setCustomerId(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                >
                  <option value="">
                    Walk-in Customer
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.name}
                      {customer.phone
                        ? ` — ${customer.phone}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Payment Method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">
                    Bank Transfer
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Discount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tax
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tax}
                    onChange={(e) =>
                      setTax(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between py-1 text-sm">
                  <span>Subtotal</span>
                  <span>
                    ₹{subtotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-1 text-sm">
                  <span>Discount</span>
                  <span>
                    -₹{discountAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between py-1 text-sm">
                  <span>Tax</span>
                  <span>
                    ₹{taxAmount.toFixed(2)}
                  </span>
                </div>

                <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg font-bold">
                  <span>Total</span>
                  <span>
                    ₹{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={completeSale}
                disabled={
                  processing || cart.length === 0
                }
                className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processing
                  ? "Processing..."
                  : "Complete Sale"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}