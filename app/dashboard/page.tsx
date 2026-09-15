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
  { name: "Products", href: "/products", icon: "📦" },
  { name: "POS Sales", href: "/pos", icon: "🛒" },
  { name: "Inventory", href: "/inventory", icon: "📊" },
  { name: "Stores", href: "/stores", icon: "🏪" },
  { name: "Suppliers", href: "/suppliers", icon: "🚚" },
  { name: "Customers", href: "/customers", icon: "👥" },
  { name: "Purchases", href: "/purchases", icon: "🧾" },
  { name: "Payments", href: "/payments", icon: "💳" },
  { name: "Returns", href: "/returns", icon: "↩️" },
  { name: "Expenses", href: "/expenses", icon: "💰" },
  { name: "Stock Transfers", href: "/stock-transfers", icon: "🔄" },
  { name: "AI Insights", href: "/ai-insights", icon: "🤖" },
  { name: "Reports", href: "/reports", icon: "📈" },
  { name: "AI Assistant", href: "/ai-assistant", icon: "✨" },
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
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-400">
              RetailPilot AI
            </p>

            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Welcome, {userName}
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Intelligent retail management dashboard
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/ai-assistant"
              className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              ✨ AI Assistant
            </Link>

            <button
              onClick={loadDashboard}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Products"
            value={stats.products}
            icon="📦"
            href="/products"
            loading={loading}
          />

          <StatCard
            title="Stores"
            value={stats.stores}
            icon="🏪"
            href="/stores"
            loading={loading}
          />

          <StatCard
            title="Customers"
            value={stats.customers}
            icon="👥"
            href="/customers"
            loading={loading}
          />

          <StatCard
            title="Suppliers"
            value={stats.suppliers}
            icon="🚚"
            href="/suppliers"
            loading={loading}
          />
        </section>

        {/* Business Summary */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Completed Sales</p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "—" : stats.sales}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Total completed transactions
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Revenue</p>

            <p className="mt-2 text-3xl font-bold text-emerald-400">
              {loading ? "—" : `₹${stats.revenue.toFixed(2)}`}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              From completed sales
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-sm text-slate-400">Stock Units</p>

            <p className="mt-2 text-3xl font-bold text-cyan-400">
              {loading ? "—" : Math.round(stats.stockUnits)}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Current inventory quantity
            </p>
          </div>
        </section>

        {/* Low Stock Alert */}
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-300">
                Inventory Health
              </p>

              <h2 className="mt-1 text-xl font-bold">
                {loading
                  ? "Checking inventory..."
                  : stats.lowStock > 0
                    ? `${stats.lowStock} product${stats.lowStock > 1 ? "s" : ""} need attention`
                    : "Inventory looks healthy"}
              </h2>
            </div>

            <Link
              href="/inventory"
              className="rounded-xl bg-cyan-500 px-4 py-2 text-center text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              Open Inventory
            </Link>
          </div>
        </section>

        {/* Modules */}
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Retail Modules</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage your complete supermarket workflow
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.07]"
              >
                <div className="text-2xl">{item.icon}</div>

                <p className="mt-3 text-sm font-semibold text-slate-200 group-hover:text-white">
                  {item.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Open module →
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* AI Recommendation */}
        <section className="mt-8 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                AI Intelligence
              </p>

              <h2 className="mt-1 text-lg font-bold">
                Ask RetailPilot AI about your business
              </h2>

              <p className="mt-1 max-w-2xl text-sm text-slate-400">
                Get live insights about profitability, low stock, supplier
                payments and business performance.
              </p>

              <p className="mt-3 text-xs text-slate-500">
                AI-generated recommendation. Verify important business
                decisions against your live records.
              </p>
            </div>

            <Link
              href="/ai-assistant"
              className="whitespace-nowrap rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-5 py-3 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/20"
            >
              Ask AI →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-white/10 pt-5 text-center text-xs text-slate-600">
          RetailPilot AI · Intelligent Retail Management SaaS
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
  href,
  loading,
}: {
  title: string;
  value: number;
  icon: string;
  href: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-white/[0.07]"
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>

        <span className="text-xs text-slate-500">View →</span>
      </div>

      <p className="mt-4 text-sm text-slate-400">{title}</p>

      <p className="mt-1 text-2xl font-bold">
        {loading ? "—" : value}
      </p>
    </Link>
  );
}