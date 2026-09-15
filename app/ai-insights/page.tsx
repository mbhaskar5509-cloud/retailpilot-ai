"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type InsightData = {
  totalProducts: number;
  lowStock: number;
  totalStockUnits: number;
  revenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  profitMargin: number;
};

export default function AIInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadInsights();
  }, []);

  async function loadInsights() {
    try {
      setLoading(true);
      setMessage("");

      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setMessage("Please log in to view AI insights.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        setMessage("Tenant information not found.");
        return;
      }

      const tenantId = profile.tenant_id;

      const [
        productsResult,
        salesResult,
        saleItemsResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select("id, reorder_level, is_active")
          .eq("tenant_id", tenantId),

        supabase
          .from("sales")
          .select("id, total_amount, status")
          .eq("tenant_id", tenantId)
          .eq("status", "completed"),

        supabase
          .from("sale_items")
          .select("product_id, quantity")
          .eq("tenant_id", tenantId),

        supabase
          .from("stock_movements")
          .select("product_id, quantity")
          .eq("tenant_id", tenantId),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (salesResult.error) throw salesResult.error;
      if (saleItemsResult.error) throw saleItemsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      const products = productsResult.data ?? [];
      const sales = salesResult.data ?? [];
      const saleItems = saleItemsResult.data ?? [];
      const movements = movementsResult.data ?? [];

      const stockMap = new Map<string, number>();

      for (const movement of movements) {
        const current = stockMap.get(movement.product_id) ?? 0;

        stockMap.set(
          movement.product_id,
          current + Number(movement.quantity ?? 0)
        );
      }

      const activeProducts = products.filter(
        (product) => product.is_active
      );

      const lowStock = activeProducts.filter((product) => {
        const stock = stockMap.get(product.id) ?? 0;
        const reorderLevel = Number(product.reorder_level ?? 0);

        return reorderLevel > 0 && stock <= reorderLevel;
      }).length;

      const totalStockUnits = activeProducts.reduce((sum, product) => {
        return sum + Math.max(stockMap.get(product.id) ?? 0, 0);
      }, 0);

      const revenue = sales.reduce(
        (sum, sale) => sum + Number(sale.total_amount ?? 0),
        0
      );

      const estimatedCost = saleItems.reduce(
        (sum, item) => sum + Number(item.quantity ?? 0),
        0
      );

      const estimatedProfit = revenue;

      const profitMargin =
        revenue > 0 ? (estimatedProfit / revenue) * 100 : 0;

      setInsights({
        totalProducts: activeProducts.length,
        lowStock,
        totalStockUnits,
        revenue,
        estimatedCost,
        estimatedProfit,
        profitMargin,
      });
    } catch (error) {
      console.error("AI Insights error:", error);
      setMessage("Unable to load AI insights.");
    } finally {
      setLoading(false);
    }
  }

  async function generateAIInsight() {
    try {
      setGenerating(true);

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question:
            "Give me a concise business summary with profit, low stock and practical recommendations.",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate AI insight.");
      }

      setMessage(data.answer || "AI insight generated successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate AI insight."
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse">
            <div className="mb-4 h-10 w-64 rounded-lg bg-slate-800" />
            <div className="h-5 w-96 rounded bg-slate-800" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-400">
              RetailPilot AI
            </p>

            <h1 className="text-3xl font-bold sm:text-4xl">
              AI Insights
            </h1>

            <p className="mt-2 text-slate-400">
              Live business intelligence from your retail data.
            </p>
          </div>

          <button
            onClick={generateAIInsight}
            disabled={generating}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate AI Insight"}
          </button>
        </div>

        {insights && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InsightCard
                title="Active Products"
                value={insights.totalProducts.toString()}
                icon="📦"
              />

              <InsightCard
                title="Low Stock"
                value={insights.lowStock.toString()}
                icon="⚠️"
              />

              <InsightCard
                title="Stock Units"
                value={insights.totalStockUnits.toString()}
                icon="🏪"
              />

              <InsightCard
                title="Revenue"
                value={`₹${insights.revenue.toFixed(2)}`}
                icon="₹"
              />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-bold">Profitability</h2>

                <div className="mt-6 space-y-5">
                  <Metric
                    label="Revenue"
                    value={`₹${insights.revenue.toFixed(2)}`}
                  />

                  <Metric
                    label="Estimated Cost"
                    value={`₹${insights.estimatedCost.toFixed(2)}`}
                  />

                  <Metric
                    label="Estimated Profit"
                    value={`₹${insights.estimatedProfit.toFixed(2)}`}
                  />

                  <Metric
                    label="Profit Margin"
                    value={`${insights.profitMargin.toFixed(2)}%`}
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h2 className="text-xl font-bold">Stock Health</h2>

                <div className="mt-6 rounded-xl bg-slate-800/70 p-5">
                  <p className="text-sm text-slate-400">
                    Current low-stock products
                  </p>

                  <p className="mt-2 text-4xl font-bold">
                    {insights.lowStock}
                  </p>

                  <p className="mt-3 text-sm text-slate-400">
                    {insights.lowStock === 0
                      ? "No products currently require immediate reorder attention."
                      : "Some products are at or below their reorder levels."}
                  </p>
                </div>
              </section>
            </div>
          </>
        )}

        {message && (
          <section className="mt-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xl">✨</span>
              <h2 className="font-bold">AI Business Recommendation</h2>
            </div>

            <p className="whitespace-pre-wrap leading-7 text-slate-200">
              {message}
            </p>

            <p className="mt-4 text-xs text-slate-500">
              AI-generated recommendation. Verify important business
              decisions.
            </p>
          </section>
        )}

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>🟢 Live Supabase Data</span>
            <span>•</span>
            <span>🤖 Gemini AI</span>
            <span>•</span>
            <span>🔒 Tenant Protected</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function InsightCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{title}</p>
        <span className="text-xl">{icon}</span>
      </div>

      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}