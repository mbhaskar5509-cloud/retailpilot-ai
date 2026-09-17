"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  reorder_level: number;
  is_active: boolean;
};

type Store = {
  id: string;
  name: string;
  city: string;
};

type Supplier = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
  name: string;
};

type Sale = {
  id: string;
  total_amount: number;
  created_at: string;
  status: string;
};

type StockMovement = {
  product_id: string;
  quantity: number;
};

type WidgetKey = "overview" | "inventory" | "actions" | "intelligence";

export default function Dashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [userName, setUserName] = useState("Business Owner");

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [error, setError] = useState("");

  const [draggedWidget, setDraggedWidget] =
    useState<WidgetKey | null>(null);

  const [widgetOrder, setWidgetOrder] = useState<WidgetKey[]>([
    "overview",
    "inventory",
    "actions",
    "intelligence",
  ]);

  const [totalStock, setTotalStock] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  const [stockByProduct, setStockByProduct] = useState<
    Record<string, number>
  >({});

  async function loadDashboard() {
    try {
      setRefreshing(true);
      setError("");

      const supabase = createClient();

      // Check login first
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        console.error(profileError);
      }

      if (!profile?.tenant_id) {
        router.replace("/login");
        return;
      }

      setUserName(profile.full_name || "Business Owner");

      const tenantId = profile.tenant_id;

      // Load products
      const { data: productData } = await supabase
        .from("products")
        .select(
          "id, name, sku, selling_price, reorder_level, is_active"
        )
        .eq("tenant_id", tenantId)
        .order("name");

      // Load stores
      const { data: storeData } = await supabase
        .from("stores")
        .select("id, name, city")
        .eq("tenant_id", tenantId)
        .order("name");

      // Load suppliers
      const { data: supplierData } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");

      // Load customers
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");

      // Load completed sales
      const { data: saleData } = await supabase
        .from("sales")
        .select("id, total_amount, created_at, status")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      // Load stock movements
      const { data: movementData } = await supabase
        .from("stock_movements")
        .select("product_id, quantity")
        .eq("tenant_id", tenantId);

      const safeProducts = (productData || []) as Product[];
      const safeStores = (storeData || []) as Store[];
      const safeSuppliers = (supplierData || []) as Supplier[];
      const safeCustomers = (customerData || []) as Customer[];
      const safeSales = (saleData || []) as Sale[];
      const safeMovements = (movementData || []) as StockMovement[];

      setProducts(safeProducts);
      setStores(safeStores);
      setSuppliers(safeSuppliers);
      setCustomers(safeCustomers);
      setSales(safeSales);
      setStockMovements(safeMovements);

      // Calculate stock
      const stockMap: Record<string, number> = {};

      for (const movement of safeMovements) {
        stockMap[movement.product_id] =
          (stockMap[movement.product_id] || 0) +
          Number(movement.quantity || 0);
      }

      setStockByProduct(stockMap);

      const stockTotal = Object.values(stockMap).reduce(
        (sum, quantity) => sum + quantity,
        0
      );

      setTotalStock(stockTotal);

      // Calculate low stock
      const lowStockProducts = safeProducts.filter((product) => {
        const stock = stockMap[product.id] || 0;
        return (
          product.is_active &&
          stock <= Number(product.reorder_level || 0)
        );
      });

      setLowStockCount(lowStockProducts.length);

      // Calculate revenue
      const totalRevenue = safeSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      setRevenue(totalRevenue);

      // Today's revenue
      const today = new Date();

      const todaysSales = safeSales.filter((sale) => {
        const saleDate = new Date(sale.created_at);

        return (
          saleDate.getFullYear() === today.getFullYear() &&
          saleDate.getMonth() === today.getMonth() &&
          saleDate.getDate() === today.getDate()
        );
      });

      const todaysRevenue = todaysSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      setTodayRevenue(todaysRevenue);
    } catch (err) {
      console.error(err);
      setError("Unable to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function handleDrop(target: WidgetKey) {
    if (!draggedWidget || draggedWidget === target) {
      setDraggedWidget(null);
      return;
    }

    const currentOrder = [...widgetOrder];

    const fromIndex = currentOrder.indexOf(draggedWidget);
    const toIndex = currentOrder.indexOf(target);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedWidget(null);
      return;
    }

    currentOrder.splice(fromIndex, 1);
    currentOrder.splice(toIndex, 0, draggedWidget);

    setWidgetOrder(currentOrder);
    setDraggedWidget(null);
  }

  function widgetEvents(name: WidgetKey) {
    return {
      draggable: true,
      onDragStart: () => setDraggedWidget(name),
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
      },
      onDrop: () => handleDrop(name),
    };
  }

  function resetLayout() {
    setWidgetOrder([
      "overview",
      "inventory",
      "actions",
      "intelligence",
    ]);
  }

  const activeProducts = products.filter(
    (product) => product.is_active
  );

  const lowStockProducts = activeProducts.filter((product) => {
    const stock = stockByProduct[product.id] || 0;
    return stock <= Number(product.reorder_level || 0);
  });

  function renderWidget(widget: WidgetKey) {
    if (widget === "overview") {
      return (
        <section
          key={widget}
          {...widgetEvents(widget)}
          className="mb-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Business overview
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Today at a glance
              </h2>
            </div>

            <span className="cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 shadow-sm">
              Drag
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Today revenue</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                ₹{todayRevenue.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-xs text-emerald-600">
                Completed sales only
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total revenue</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                ₹{revenue.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                All completed sales
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Stock units</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {totalStock.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                From stock movement ledger
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Low stock</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {lowStockCount}
              </p>
              <p className="mt-2 text-xs text-orange-600">
                Needs attention
              </p>
            </div>
          </div>
        </section>
      );
    }

    if (widget === "inventory") {
      return (
        <section
          key={widget}
          {...widgetEvents(widget)}
          className="mb-6"
        >
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Inventory health
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Stock requiring attention
                </h2>
              </div>

              <Link
                href="/inventory"
                className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Open inventory
              </Link>
            </div>

            <div className="mt-5">
              {lowStockProducts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                  <p className="font-semibold text-emerald-800">
                    Inventory looks healthy
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    No active products are currently at or below their
                    reorder level.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left">
                    <thead>
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-3">Product</th>
                        <th className="px-3 py-3">SKU</th>
                        <th className="px-3 py-3">Stock</th>
                        <th className="px-3 py-3">Reorder level</th>
                      </tr>
                    </thead>

                    <tbody>
                      {lowStockProducts.slice(0, 6).map((product) => (
                        <tr
                          key={product.id}
                          className="border-b border-slate-50"
                        >
                          <td className="px-3 py-4 font-semibold text-slate-800">
                            {product.name}
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-500">
                            {product.sku}
                          </td>

                          <td className="px-3 py-4">
                            <span className="rounded-lg bg-orange-50 px-2 py-1 text-sm font-semibold text-orange-700">
                              {stockByProduct[product.id] || 0}
                            </span>
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-500">
                            {product.reorder_level}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (widget === "actions") {
      const actions = [
        {
          title: "New sale",
          description: "Open POS and create a sale",
          href: "/pos",
        },
        {
          title: "Add product",
          description: "Create or update products",
          href: "/products",
        },
        {
          title: "Purchase stock",
          description: "Record a supplier purchase",
          href: "/purchases",
        },
        {
          title: "Stock transfer",
          description: "Move inventory between stores",
          href: "/stock-transfers",
        },
      ];

      return (
        <section
          key={widget}
          {...widgetEvents(widget)}
          className="mb-6"
        >
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                Quick actions
              </p>

              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Run your business
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    →
                  </div>

                  <h3 className="mt-4 font-bold text-slate-900">
                    {action.title}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {action.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      );
    }

    return (
      <section
        key={widget}
        {...widgetEvents(widget)}
        className="mb-6"
      >
        <div className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
                AI intelligence
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Make decisions with live business data
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Ask the RetailPilot AI Assistant about low stock,
                dead stock, profitability, supplier outstanding and
                business reports.
              </p>

              <p className="mt-4 text-xs text-slate-400">
                AI-generated recommendation. Verify important business
                decisions before acting.
              </p>
            </div>

            <Link
              href="/ai-assistant"
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-blue-50"
            >
              Open AI Assistant →
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="mt-4 text-sm font-medium text-slate-500">
              Loading RetailPilot AI...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-sm">
              R
            </div>

            <div>
              <p className="text-sm font-bold text-slate-900">
                RetailPilot AI
              </p>

              <p className="text-xs text-slate-500">
                Intelligent Retail Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadDashboard()}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <div className="hidden rounded-xl bg-blue-50 px-4 py-2 sm:block">
              <p className="text-xs text-blue-500">Signed in as</p>
              <p className="text-sm font-bold text-blue-900">
                {userName}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-6 text-white shadow-lg sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">
                Welcome back
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {userName}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
                Manage products, inventory, sales, suppliers and
                business intelligence from one connected workspace.
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                Live workspace
              </p>

              <p className="mt-2 text-2xl font-black">
                {stores.length}
              </p>

              <p className="text-sm text-blue-100">
                Active store locations
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Widget controls */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Dashboard workspace
            </p>

            <p className="text-xs text-slate-400">
              Drag sections to rearrange your dashboard.
            </p>
          </div>

          <button
            onClick={resetLayout}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
          >
            Reset layout
          </button>
        </div>

        {/* Widgets */}
        {widgetOrder.map((widget) => renderWidget(widget))}

        {/* Business summary */}
        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/stores"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">Stores</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {stores.length}
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Manage locations →
            </p>
          </Link>

          <Link
            href="/suppliers"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">Suppliers</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {suppliers.length}
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Manage suppliers →
            </p>
          </Link>

          <Link
            href="/customers"
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
          >
            <p className="text-sm text-slate-500">Customers</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {customers.length}
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Manage customers →
            </p>
          </Link>
        </section>
      </div>
    </main>
  );
}