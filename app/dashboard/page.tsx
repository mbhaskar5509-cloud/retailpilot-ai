"use client";

import { useEffect, useMemo, useState } from "react";
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
  city: string | null;
};

type Supplier = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
};

type Sale = {
  id: string;
  total_amount: number;
  created_at: string;
};

type StockMovement = {
  product_id: string;
  quantity: number;
};

type WidgetKey =
  | "overview"
  | "inventory"
  | "actions"
  | "intelligence";

const defaultWidgets: WidgetKey[] = [
  "overview",
  "inventory",
  "actions",
  "intelligence",
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("Business Owner");

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [widgets, setWidgets] =
    useState<WidgetKey[]>(defaultWidgets);

  const [draggedWidget, setDraggedWidget] =
    useState<WidgetKey | null>(null);

  const supabase = useMemo(() => createClient(), []);

  async function loadDashboard() {
    try {
      setRefreshing(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id, full_name")
        .eq("id", user.id)
        .single();

      if (!profile?.tenant_id) return;

      setUserName(profile.full_name || "Business Owner");

      const tenantId = profile.tenant_id;

      const [
        productsResult,
        storesResult,
        suppliersResult,
        customersResult,
        salesResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select(
            "id,name,sku,selling_price,reorder_level,is_active"
          )
          .eq("tenant_id", tenantId)
          .eq("is_active", true),

        supabase
          .from("stores")
          .select("id,name,city")
          .eq("tenant_id", tenantId),

        supabase
          .from("suppliers")
          .select("id,name")
          .eq("tenant_id", tenantId),

        supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenantId),

        supabase
          .from("sales")
          .select("id,total_amount,created_at")
          .eq("tenant_id", tenantId)
          .eq("status", "completed")
          .order("created_at", { ascending: false }),

        supabase
          .from("stock_movements")
          .select("product_id,quantity")
          .eq("tenant_id", tenantId),
      ]);

      setProducts(productsResult.data || []);
      setStores(storesResult.data || []);
      setSuppliers(suppliersResult.data || []);
      setCustomers(customersResult.data || []);
      setSales(salesResult.data || []);
      setStockMovements(movementsResult.data || []);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const stockByProduct = useMemo(() => {
    const result: Record<string, number> = {};

    for (const movement of stockMovements) {
      result[movement.product_id] =
        (result[movement.product_id] || 0) +
        Number(movement.quantity || 0);
    }

    return result;
  }, [stockMovements]);

  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = stockByProduct[product.id] || 0;
      return stock <= Number(product.reorder_level || 0);
    });
  }, [products, stockByProduct]);

  const totalStock = useMemo(() => {
    return Object.values(stockByProduct).reduce(
      (sum, value) => sum + value,
      0
    );
  }, [stockByProduct]);

  const revenue = useMemo(() => {
    return sales.reduce(
      (sum, sale) => sum + Number(sale.total_amount || 0),
      0
    );
  }, [sales]);

  const todayRevenue = useMemo(() => {
    const today = new Date().toDateString();

    return sales
      .filter(
        (sale) =>
          new Date(sale.created_at).toDateString() === today
      )
      .reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );
  }, [sales]);

  function formatCurrency(value: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function moveWidget(
    source: WidgetKey,
    target: WidgetKey
  ) {
    if (source === target) return;

    const updated = [...widgets];

    const sourceIndex = updated.indexOf(source);
    const targetIndex = updated.indexOf(target);

    if (sourceIndex === -1 || targetIndex === -1) return;

    updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, source);

    setWidgets(updated);
  }

  function resetLayout() {
    setWidgets(defaultWidgets);
  }

  function renderWidget(widget: WidgetKey) {
    switch (widget) {
      case "overview":
        return (
          <section
            draggable
            onDragStart={() => setDraggedWidget("overview")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedWidget) {
                moveWidget(draggedWidget, "overview");
              }
              setDraggedWidget(null);
            }}
            className="space-y-5"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                title="Total Revenue"
                value={formatCurrency(revenue)}
                subtitle={`${sales.length} completed sales`}
                icon="₹"
                accent="blue"
              />

              <KpiCard
                title="Today's Sales"
                value={formatCurrency(todayRevenue)}
                subtitle="Live sales data"
                icon="↗"
                accent="cyan"
              />

              <KpiCard
                title="Total Products"
                value={products.length.toString()}
                subtitle={`${lowStockProducts.length} low stock`}
                icon="▦"
                accent="indigo"
              />

              <KpiCard
                title="Total Stock"
                value={totalStock.toLocaleString("en-IN")}
                subtitle={`${stores.length} active stores`}
                icon="▣"
                accent="violet"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <MetricCard
                title="Customers"
                value={customers.length}
                description="Registered customers"
                icon="◉"
              />

              <MetricCard
                title="Suppliers"
                value={suppliers.length}
                description="Supplier accounts"
                icon="◇"
              />

              <MetricCard
                title="Stores"
                value={stores.length}
                description="Business locations"
                icon="⌂"
              />
            </div>
          </section>
        );

      case "inventory":
        return (
          <section
            draggable
            onDragStart={() => setDraggedWidget("inventory")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedWidget) {
                moveWidget(draggedWidget, "inventory");
              }
              setDraggedWidget(null);
            }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                  Inventory
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Inventory Health
                </h2>
              </div>

              <Link
                href="/inventory"
                className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                View Inventory →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <HealthCard
                title="Healthy Stock"
                value={Math.max(
                  products.length - lowStockProducts.length,
                  0
                )}
                description="Products above reorder level"
                icon="✓"
                positive
              />

              <HealthCard
                title="Low Stock"
                value={lowStockProducts.length}
                description="Needs attention"
                icon="!"
                warning={lowStockProducts.length > 0}
              />

              <HealthCard
                title="Stock Units"
                value={totalStock}
                description="Current movement balance"
                icon="▥"
              />
            </div>

            {lowStockProducts.length > 0 && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 font-bold text-amber-700">
                    !
                  </div>

                  <div>
                    <p className="font-bold text-amber-900">
                      Low-stock attention required
                    </p>
                    <p className="text-sm text-amber-700">
                      {lowStockProducts
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(", ")}
                      {lowStockProducts.length > 3
                        ? ` +${lowStockProducts.length - 3} more`
                        : ""}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        );

      case "actions":
        return (
          <section
            draggable
            onDragStart={() => setDraggedWidget("actions")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedWidget) {
                moveWidget(draggedWidget, "actions");
              }
              setDraggedWidget(null);
            }}
          >
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
                  Workspace
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Quick Actions
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <ActionCard
                href="/products"
                icon="▦"
                title="Products"
                description="Manage catalog"
              />

              <ActionCard
                href="/pos"
                icon="₹"
                title="POS"
                description="Create sale"
                primary
              />

              <ActionCard
                href="/inventory"
                icon="▥"
                title="Inventory"
                description="Track stock"
              />

              <ActionCard
                href="/purchases"
                icon="↓"
                title="Purchases"
                description="Buy stock"
              />

              <ActionCard
                href="/stock-transfers"
                icon="⇄"
                title="Transfers"
                description="Move stock"
              />

              <ActionCard
                href="/reports"
                icon="◫"
                title="Reports"
                description="Business reports"
              />
            </div>
          </section>
        );

      case "intelligence":
        return (
          <section
            draggable
            onDragStart={() => setDraggedWidget("intelligence")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedWidget) {
                moveWidget(draggedWidget, "intelligence");
              }
              setDraggedWidget(null);
            }}
            className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 p-7 text-white shadow-xl shadow-blue-900/20"
          >
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">
                  <span className="h-2 w-2 rounded-full bg-cyan-300" />
                  AI Intelligence
                </div>

                <h2 className="text-2xl font-bold md:text-3xl">
                  Make smarter retail decisions with AI.
                </h2>

                <p className="mt-3 leading-7 text-blue-100">
                  Analyze live inventory, sales, profitability,
                  supplier outstanding and business performance
                  using RetailPilot AI.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link
                  href="/ai-assistant"
                  className="rounded-2xl bg-white px-6 py-3 text-center text-sm font-bold text-blue-800 transition hover:bg-blue-50"
                >
                  Ask AI Assistant →
                </Link>

                <Link
                  href="/ai-insights"
                  className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/20"
                >
                  View AI Insights
                </Link>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f7fb]">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 font-semibold text-slate-600">
            Loading RetailPilot AI...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-lg font-black text-white shadow-lg shadow-blue-600/20">
              R
            </div>

            <div>
              <p className="text-base font-black tracking-tight text-slate-950">
                RetailPilot
                <span className="text-blue-600"> AI</span>
              </p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:block">
                Retail Intelligence
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/ai-assistant"
              className="hidden rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 sm:block"
            >
              ✦ Ask AI
            </Link>

            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50"
            >
              {refreshing ? "..." : "↻"}
            </button>

            <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-sm font-black text-blue-700">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {userName}
                </p>
                <p className="text-[10px] text-slate-400">
                  Business Owner
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Hero */}
        <section className="relative mb-7 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-2xl shadow-blue-950/20 md:p-9">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              Live Supabase Business Data
            </div>

            <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
              <div>
                <p className="text-sm font-medium text-blue-200">
                  Welcome back,
                </p>

                <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
                  {userName}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 md:text-base">
                  Control your supermarket operations, monitor
                  inventory and make data-driven decisions from one
                  intelligent workspace.
                </p>
              </div>

              <div className="flex gap-3">
                <Link
                  href="/pos"
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-blue-800 shadow-xl transition hover:bg-blue-50"
                >
                  + New Sale
                </Link>

                <Link
                  href="/reports"
                  className="hidden rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/20 sm:block"
                >
                  Reports
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Drag info */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Business Overview
            </h2>
            <p className="text-sm text-slate-500">
              Drag sections to customize your dashboard.
            </p>
          </div>

          <button
            onClick={resetLayout}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
          >
            Reset Layout
          </button>
        </div>

        {/* Draggable Widgets */}
        <div className="space-y-7">
          {widgets.map((widget) => (
            <div
              key={widget}
              className={
                draggedWidget === widget
                  ? "rounded-3xl ring-2 ring-blue-400 ring-offset-4"
                  : ""
              }
            >
              {renderWidget(widget)}
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-slate-200 py-6 text-center">
          <p className="text-xs font-semibold text-slate-400">
            RetailPilot AI • Intelligent Retail Management SaaS
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Live data • Supabase • AI-powered business intelligence
          </p>
        </footer>
      </div>
    </main>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  accent: "blue" | "cyan" | "indigo" | "violet";
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-700",
    cyan: "bg-cyan-50 text-cyan-700",
    indigo: "bg-indigo-50 text-indigo-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {value}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black ${accents[accent]}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-lg font-black text-blue-700">
          {icon}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {value}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function HealthCard({
  title,
  value,
  description,
  icon,
  positive,
  warning,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-700">{title}</p>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${
            positive
              ? "bg-emerald-100 text-emerald-700"
              : warning
                ? "bg-amber-100 text-amber-700"
                : "bg-blue-100 text-blue-700"
          }`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-3xl font-black text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
  primary,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-xl ${
        primary
          ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/20"
          : "border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:shadow-blue-900/5"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl text-base font-black ${
          primary
            ? "bg-white/15 text-white"
            : "bg-blue-50 text-blue-700"
        }`}
      >
        {icon}
      </div>

      <p className="mt-4 text-sm font-black">{title}</p>

      <p
        className={`mt-1 text-[11px] ${
          primary ? "text-blue-100" : "text-slate-400"
        }`}
      >
        {description}
      </p>
    </Link>
  );
}