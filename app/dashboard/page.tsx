"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type DashboardStats = {
  products: number;
  stores: number;
  suppliers: number;
  customers: number;
  sales: number;
  revenue: number;
  stockUnits: number;
  lowStock: number;
};

const defaultStats: DashboardStats = {
  products: 0,
  stores: 0,
  suppliers: 0,
  customers: 0,
  sales: 0,
  revenue: 0,
  stockUnits: 0,
  lowStock: 0,
};

const menuItems = [
  { name: "Products", href: "/products", icon: "📦", desc: "Catalog & pricing" },
  { name: "POS Sales", href: "/pos", icon: "🛒", desc: "Create sales" },
  { name: "Inventory", href: "/inventory", icon: "📊", desc: "Track stock" },
  { name: "Stores", href: "/stores", icon: "🏪", desc: "Manage locations" },
  { name: "Suppliers", href: "/suppliers", icon: "🚚", desc: "Supplier network" },
  { name: "Customers", href: "/customers", icon: "👥", desc: "Customer records" },
  { name: "Purchases", href: "/purchases", icon: "🧾", desc: "Purchase orders" },
  { name: "Payments", href: "/payments", icon: "💳", desc: "Payment tracking" },
  { name: "Returns", href: "/returns", icon: "↩️", desc: "Manage returns" },
  { name: "Expenses", href: "/expenses", icon: "💰", desc: "Business expenses" },
  { name: "Stock Transfers", href: "/stock-transfers", icon: "🔄", desc: "Move stock" },
  { name: "AI Insights", href: "/ai-insights", icon: "🤖", desc: "Smart insights" },
  { name: "Reports", href: "/reports", icon: "📈", desc: "Business reports" },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Business Owner");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tenant_id, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id) {
        setLoading(false);
        return;
      }

      if (profile.full_name) {
        setUserName(profile.full_name);
      }

      const tenantId = profile.tenant_id;

      const [
        productsResult,
        storesResult,
        suppliersResult,
        customersResult,
        salesResult,
        stockResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id, reorder_level")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),

        supabase
          .from("stores")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),

        supabase
          .from("suppliers")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),

        supabase
          .from("customers")
          .select("id")
          .eq("tenant_id", tenantId),

        supabase
          .from("sales")
          .select("id, total_amount")
          .eq("tenant_id", tenantId)
          .eq("status", "completed"),

        supabase
          .from("stock_movements")
          .select("product_id, movement_type, quantity")
          .eq("tenant_id", tenantId),
      ]);

      const products = productsResult.data ?? [];
      const stores = storesResult.data ?? [];
      const suppliers = suppliersResult.data ?? [];
      const customers = customersResult.data ?? [];
      const sales = salesResult.data ?? [];
      const movements = stockResult.data ?? [];

      const stockMap: Record<string, number> = {};

      for (const movement of movements) {
        const productId = movement.product_id;

        if (!stockMap[productId]) {
          stockMap[productId] = 0;
        }

        const quantity = Number(movement.quantity) || 0;

        if (
          movement.movement_type === "purchase" ||
          movement.movement_type === "customer_return" ||
          movement.movement_type === "transfer_in"
        ) {
          stockMap[productId] += Math.abs(quantity);
        } else if (
          movement.movement_type === "sale" ||
          movement.movement_type === "supplier_return" ||
          movement.movement_type === "damage" ||
          movement.movement_type === "transfer_out"
        ) {
          stockMap[productId] -= Math.abs(quantity);
        } else {
          stockMap[productId] += quantity;
        }
      }

      const stockUnits = Object.values(stockMap).reduce(
        (total, value) => total + Math.max(0, value),
        0
      );

      const lowStock = products.filter((product) => {
        const currentStock = stockMap[product.id] ?? 0;
        return currentStock <= Number(product.reorder_level || 0);
      }).length;

      const revenue = sales.reduce(
        (total, sale) => total + Number(sale.total_amount || 0),
        0
      );

      setStats({
        products: products.length,
        stores: stores.length,
        suppliers: suppliers.length,
        customers: customers.length,
        sales: sales.length,
        revenue,
        stockUnits,
        lowStock,
      });
    } catch (error) {
      console.error("Dashboard loading error:", error);
      setStats(defaultStats);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        {/* TOP NAV */}
        <header className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-xl shadow-lg">
                🛒
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">
                  RetailPilot AI
                </p>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                  Business Dashboard
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Account
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {userName}
                </p>
              </div>

              <Link
                href="/ai-assistant"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
              >
                ✨ Ask AI
              </Link>

              <button
                onClick={loadDashboard}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="mb-6 overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live business data
              </div>

              <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Welcome back, {userName}
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Monitor sales, inventory, stores and business operations from
                one intelligent retail workspace.
              </p>
            </div>

            <Link
              href="/reports"
              className="w-fit rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
            >
              View Reports →
            </Link>
          </div>
        </section>

        {/* KPI */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Total Products"
            value={stats.products}
            icon="📦"
            href="/products"
            loading={loading}
            accent="cyan"
          />

          <KpiCard
            title="Active Stores"
            value={stats.stores}
            icon="🏪"
            href="/stores"
            loading={loading}
            accent="violet"
          />

          <KpiCard
            title="Customers"
            value={stats.customers}
            icon="👥"
            href="/customers"
            loading={loading}
            accent="blue"
          />

          <KpiCard
            title="Suppliers"
            value={stats.suppliers}
            icon="🚚"
            href="/suppliers"
            loading={loading}
            accent="amber"
          />
        </section>

        {/* BUSINESS METRICS */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <MetricCard
            label="Completed Sales"
            value={loading ? "—" : stats.sales.toString()}
            description="Completed transactions"
            icon="🛒"
          />

          <MetricCard
            label="Revenue"
            value={loading ? "—" : `₹${stats.revenue.toFixed(2)}`}
            description="From completed sales"
            icon="₹"
            highlight
          />

          <MetricCard
            label="Stock Units"
            value={loading ? "—" : Math.round(stats.stockUnits).toString()}
            description="Current inventory quantity"
            icon="📦"
          />
        </section>

        {/* INVENTORY HEALTH */}
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                {stats.lowStock > 0 ? "⚠️" : "✓"}
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Inventory Health
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {loading
                    ? "Checking inventory..."
                    : stats.lowStock > 0
                      ? `${stats.lowStock} product${
                          stats.lowStock > 1 ? "s" : ""
                        } need attention`
                      : "Inventory is healthy"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {stats.lowStock > 0
                    ? "Review low-stock products and reorder levels."
                    : "No products are currently below their reorder level."}
                </p>
              </div>
            </div>

            <Link
              href="/inventory"
              className="rounded-xl bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Open Inventory →
            </Link>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-600">
                Workspace
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">
                Quick Actions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Access your retail operations quickly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-cyan-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-slate-300 transition group-hover:text-cyan-500">
                    →
                  </span>
                </div>

                <p className="mt-4 text-sm font-bold text-slate-800">
                  {item.name}
                </p>

                <p className="mt-1 text-xs text-slate-400">{item.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* AI SECTION */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50/60 to-blue-50 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-cyan-700 shadow-sm">
                🤖 AI Intelligence
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Make smarter retail decisions with RetailPilot AI
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Ask about profitability, low stock, supplier outstanding,
                dead stock and overall business performance using your live
                business data.
              </p>

              <p className="mt-4 text-xs text-slate-400">
                AI-generated recommendation. Verify important business
                decisions against your live records.
              </p>
            </div>

            <Link
              href="/ai-assistant"
              className="w-fit rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800"
            >
              Open AI Assistant →
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-10 border-t border-slate-200 py-6 text-center">
          <p className="text-xs font-semibold text-slate-400">
            RetailPilot AI · Intelligent Retail Management SaaS
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Multi-tenant retail operations · Inventory · Sales · AI Insights
          </p>
        </footer>
      </div>
    </main>
  );
}

function KpiCard({
  title,
  value,
  icon,
  href,
  loading,
  accent,
}: {
  title: string;
  value: number;
  icon: string;
  href: string;
  loading: boolean;
  accent: "cyan" | "violet" | "blue" | "amber";
}) {
  const accentClasses = {
    cyan: "bg-cyan-50 text-cyan-700",
    violet: "bg-violet-50 text-violet-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <Link
      href={href}
      className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${accentClasses[accent]}`}
        >
          {icon}
        </div>

        <span className="text-xs font-semibold text-slate-300 transition group-hover:text-cyan-500">
          View →
        </span>
      </div>

      <p className="mt-5 text-sm font-medium text-slate-500">{title}</p>

      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
        {loading ? "—" : value}
      </p>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <p
            className={`mt-2 text-3xl font-bold tracking-tight ${
              highlight ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-lg font-bold text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}