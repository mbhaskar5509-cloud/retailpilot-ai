"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReportsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [returns, setReturns] = useState(0);
  const [products, setProducts] = useState(0);
  const [stockUnits, setStockUnits] = useState(0);
  const [error, setError] = useState("");

  const loadReport = async () => {
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
        throw new Error("Tenant profile not found.");
      }

      const tenantId = profile.tenant_id;

      const [
        salesResult,
        expensesResult,
        returnsResult,
        productsResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("total_amount, status")
          .eq("tenant_id", tenantId),

        supabase
          .from("expenses")
          .select("amount")
          .eq("tenant_id", tenantId),

        supabase
          .from("returns")
          .select("total_amount, status")
          .eq("tenant_id", tenantId),

        supabase
          .from("products")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true),

        supabase
          .from("stock_movements")
          .select("product_id, quantity")
          .eq("tenant_id", tenantId),
      ]);

      if (salesResult.error) throw salesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (returnsResult.error) throw returnsResult.error;
      if (productsResult.error) throw productsResult.error;
      if (movementsResult.error) throw movementsResult.error;

      const completedSales = salesResult.data?.filter(
        (sale) => sale.status === "completed"
      ) || [];

      const totalRevenue = completedSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      const totalExpenses =
        expensesResult.data?.reduce(
          (sum, expense) => sum + Number(expense.amount || 0),
          0
        ) || 0;

      const totalReturns =
        returnsResult.data
          ?.filter((item) => item.status === "completed")
          .reduce(
            (sum, item) => sum + Number(item.total_amount || 0),
            0
          ) || 0;

      const stockMap: Record<string, number> = {};

      movementsResult.data?.forEach((movement) => {
        stockMap[movement.product_id] =
          (stockMap[movement.product_id] || 0) +
          Number(movement.quantity || 0);
      });

      const currentStock = Object.values(stockMap).reduce(
        (sum, quantity) => sum + quantity,
        0
      );

      setRevenue(totalRevenue);
      setExpenses(totalExpenses);
      setReturns(totalReturns);
      setSalesCount(completedSales.length);
      setProducts(productsResult.data?.length || 0);
      setStockUnits(currentStock);
    } catch (err: any) {
      setError(err.message || "Unable to load report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const netPosition = revenue - expenses - returns;

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
            flexWrap: "wrap",
            marginBottom: "28px",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                background: "#dbeafe",
                color: "#1d4ed8",
                padding: "6px 12px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                marginBottom: "10px",
              }}
            >
              BUSINESS ANALYTICS
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                fontWeight: 800,
              }}
            >
              Reports 📊
            </h1>

            <p
              style={{
                marginTop: "8px",
                color: "#64748b",
                fontSize: "15px",
              }}
            >
              Real-time business performance from your RetailPilot database.
            </p>
          </div>

          <button
            onClick={loadReport}
            style={{
              border: "none",
              borderRadius: "10px",
              padding: "13px 20px",
              background: "#2563eb",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ↻ Refresh Report
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
          <strong>AI-generated recommendation:</strong> Financial insights
          should be verified against accounting records before making business
          decisions.
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "50px",
              textAlign: "center",
            }}
          >
            📊 Generating business report...
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(210px, 1fr))",
                gap: "18px",
                marginBottom: "28px",
              }}
            >
              {[
                ["💰", "Total Revenue", `₹${revenue.toFixed(2)}`],
                ["🧾", "Completed Sales", salesCount.toString()],
                ["💸", "Expenses", `₹${expenses.toFixed(2)}`],
                ["↩️", "Returns", `₹${returns.toFixed(2)}`],
                ["📦", "Active Products", products.toString()],
                ["🏪", "Current Stock", `${stockUnits} units`],
              ].map(([icon, title, value]) => (
                <div
                  key={title}
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    padding: "22px",
                    boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
                  }}
                >
                  <div style={{ fontSize: "26px" }}>{icon}</div>

                  <div
                    style={{
                      color: "#64748b",
                      fontSize: "13px",
                      fontWeight: 600,
                      marginTop: "14px",
                    }}
                  >
                    {title}
                  </div>

                  <div
                    style={{
                      fontSize: "25px",
                      fontWeight: 800,
                      marginTop: "6px",
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <section
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "24px",
                marginBottom: "24px",
                boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
              }}
            >
              <h2
                style={{
                  margin: "0 0 20px",
                  fontSize: "20px",
                  fontWeight: 800,
                }}
              >
                Financial Summary
              </h2>

              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <span>Total Revenue</span>
                  <strong>₹{revenue.toFixed(2)}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <span>Less: Expenses</span>
                  <strong>₹{expenses.toFixed(2)}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "14px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <span>Less: Returns</span>
                  <strong>₹{returns.toFixed(2)}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "16px",
                    background: "#eff6ff",
                    borderRadius: "10px",
                    fontSize: "17px",
                  }}
                >
                  <strong>Net Position</strong>
                  <strong>₹{netPosition.toFixed(2)}</strong>
                </div>
              </div>
            </section>

            {/* Report Insights */}
            <section
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 4px 18px rgba(15,23,42,0.06)",
              }}
            >
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: "20px",
                  fontWeight: 800,
                }}
              >
                📌 Report Insights
              </h2>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "14px",
                  marginBottom: "20px",
                }}
              >
                Key observations from the current database.
              </p>

              <div style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <strong>Sales:</strong> {salesCount} completed sale
                  {salesCount !== 1 ? "s" : ""} recorded.
                </div>

                <div
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <strong>Inventory:</strong> {stockUnits} units are currently
                  represented in the stock movement ledger.
                </div>

                <div
                  style={{
                    padding: "16px",
                    background: "#f8fafc",
                    borderRadius: "10px",
                  }}
                >
                  <strong>Next upgrade:</strong> MCP will generate detailed
                  profitability, dead-stock, supplier outstanding and
                  executive business reports.
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}