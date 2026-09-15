"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Insight = {
  title: string;
  value: string;
  description: string;
  type: "warning" | "success" | "info";
};

export default function AIInsightsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [error, setError] = useState("");

  const loadInsights = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please login first.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setError("Tenant profile not found.");
        return;
      }

      const tenantId = profile.tenant_id;

      // Products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(
          "id, name, sku, selling_price, purchase_price, reorder_level"
        )
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (productsError) throw productsError;

      // Stock movements
      const { data: movements, error: movementsError } = await supabase
        .from("stock_movements")
        .select("product_id, movement_type, quantity, created_at")
        .eq("tenant_id", tenantId);

      if (movementsError) throw movementsError;

      // Sales
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("total_amount, status, sale_date")
        .eq("tenant_id", tenantId);

      if (salesError) throw salesError;

      const productList = products || [];
      const movementList = movements || [];
      const salesList = sales || [];

      // Calculate current stock from immutable ledger
      const stockMap: Record<string, number> = {};

      movementList.forEach((movement) => {
        if (!stockMap[movement.product_id]) {
          stockMap[movement.product_id] = 0;
        }

        stockMap[movement.product_id] += Number(movement.quantity || 0);
      });

      const lowStockProducts = productList.filter((product) => {
        const stock = stockMap[product.id] || 0;
        return stock <= Number(product.reorder_level || 0);
      });

      const totalStockUnits = productList.reduce(
        (sum, product) => sum + (stockMap[product.id] || 0),
        0
      );

      const completedSales = salesList.filter(
        (sale) => sale.status === "completed"
      );

      const totalRevenue = completedSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      const estimatedProfit = completedSales.length
        ? totalRevenue * 0.2
        : 0;

      const generatedInsights: Insight[] = [];

      if (lowStockProducts.length > 0) {
        generatedInsights.push({
          title: "Low Stock Alert",
          value: `${lowStockProducts.length} products`,
          description:
            "These products are at or below their reorder level. Consider creating a purchase order.",
          type: "warning",
        });
      } else {
        generatedInsights.push({
          title: "Stock Health",
          value: "Healthy",
          description:
            "No active products are currently below their reorder level.",
          type: "success",
        });
      }

      generatedInsights.push({
        title: "Current Inventory",
        value: `${totalStockUnits} units`,
        description:
          "Current stock is calculated from the stock movement ledger.",
        type: "info",
      });

      generatedInsights.push({
        title: "Sales Revenue",
        value: `₹${totalRevenue.toFixed(2)}`,
        description:
          "Revenue calculated from completed sales available in the database.",
        type: "success",
      });

      generatedInsights.push({
        title: "Estimated Profit",
        value: `₹${estimatedProfit.toFixed(2)}`,
        description:
          "Indicative estimate for the dashboard. Final profitability will use purchase cost data through MCP.",
        type: "info",
      });

      setInsights(generatedInsights);
    } catch (err: any) {
      setError(err.message || "Unable to generate insights.");
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    setGenerating(true);

    await new Promise((resolve) => setTimeout(resolve, 900));

    await loadInsights();

    setGenerating(false);
  };

  useEffect(() => {
    loadInsights();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        padding: "32px",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            marginBottom: "28px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "#ede9fe",
                color: "#6d28d9",
                padding: "6px 12px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                marginBottom: "10px",
              }}
            >
              AI BUSINESS INTELLIGENCE
            </div>

            <h1
              style={{
                fontSize: "32px",
                fontWeight: 800,
                margin: 0,
              }}
            >
              AI Insights 🤖
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              Real-time business insights generated from your RetailPilot data.
            </p>
          </div>

          <button
            onClick={generateAIInsights}
            disabled={generating}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "13px 20px",
              background: generating ? "#94a3b8" : "#7c3aed",
              color: "white",
              fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            {generating ? "Generating..." : "✨ Generate AI Insights"}
          </button>
        </div>

        {/* Disclaimer */}
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: "12px",
            padding: "14px 16px",
            marginBottom: "24px",
            color: "#9a3412",
            fontSize: "13px",
          }}
        >
          <strong>AI-generated recommendation:</strong> Insights are
          recommendations based on currently available business data. Verify
          important decisions before acting.
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "16px",
              borderRadius: "12px",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "50px",
              textAlign: "center",
              boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>🤖</div>
            <strong>Analyzing your business data...</strong>
          </div>
        ) : (
          <>
            {/* Insight Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(230px, 1fr))",
                gap: "18px",
                marginBottom: "28px",
              }}
            >
              {insights.map((insight, index) => {
                const icon =
                  insight.type === "warning"
                    ? "⚠️"
                    : insight.type === "success"
                    ? "📈"
                    : "💡";

                return (
                  <div
                    key={index}
                    style={{
                      background: "white",
                      borderRadius: "16px",
                      padding: "22px",
                      boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "26px",
                        marginBottom: "14px",
                      }}
                    >
                      {icon}
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      {insight.title}
                    </div>

                    <div
                      style={{
                        fontSize: "25px",
                        fontWeight: 800,
                        marginTop: "6px",
                      }}
                    >
                      {insight.value}
                    </div>

                    <p
                      style={{
                        color: "#64748b",
                        fontSize: "13px",
                        lineHeight: 1.6,
                        marginTop: "10px",
                      }}
                    >
                      {insight.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* AI Recommendations */}
            <section
              style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
              }}
            >
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  margin: "0 0 8px",
                }}
              >
                🧠 Business Recommendations
              </h2>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "14px",
                  marginBottom: "20px",
                }}
              >
                RetailPilot analyzes inventory and sales activity to identify
                opportunities.
              </p>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    borderLeft: "4px solid #7c3aed",
                  }}
                >
                  <strong>Inventory:</strong> Monitor products approaching
                  their reorder threshold and plan purchases early.
                </div>

                <div
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    borderLeft: "4px solid #2563eb",
                  }}
                >
                  <strong>Sales:</strong> Review completed sales regularly to
                  identify high-performing products and stores.
                </div>

                <div
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    borderLeft: "4px solid #16a34a",
                  }}
                >
                  <strong>Next AI upgrade:</strong> MCP tools will provide live
                  low-stock, dead-stock, profitability, supplier outstanding
                  and business-report analysis.
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}