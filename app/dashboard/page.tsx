"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type DashboardStats = {
  sales: number;
  profit: number;
  products: number;
  lowStock: number;
  stores: number;
  customers: number;
};

const defaultStats: DashboardStats = {
  sales: 0,
  profit: 0,
  products: 0,
  lowStock: 0,
  stores: 0,
  customers: 0,
};

const modules = [
  {
    title: "Products",
    description: "Manage products, prices and stock settings",
    href: "/products",
    icon: "📦",
  },
  {
    title: "POS Sales",
    description: "Create sales and process customer payments",
    href: "/pos",
    icon: "🛒",
  },
  {
    title: "Inventory",
    description: "Monitor stock and movement history",
    href: "/inventory",
    icon: "📊",
  },
  {
    title: "Stores",
    description: "Manage supermarket branches",
    href: "/stores",
    icon: "🏪",
  },
  {
    title: "Suppliers",
    description: "Manage suppliers and payment terms",
    href: "/suppliers",
    icon: "🚚",
  },
  {
    title: "Customers",
    description: "Manage customers and loyalty information",
    href: "/customers",
    icon: "👥",
  },
  {
    title: "Purchases",
    description: "Track purchases and supplier invoices",
    href: "/purchases",
    icon: "🧾",
  },
  {
    title: "Payments",
    description: "Track sales payment transactions",
    href: "/payments",
    icon: "💳",
  },
  {
    title: "Returns",
    description: "Manage customer and supplier returns",
    href: "/returns",
    icon: "↩️",
  },
  {
    title: "Expenses",
    description: "Track business expenses",
    href: "/expenses",
    icon: "💰",
  },
  {
    title: "Stock Transfers",
    description: "Transfer inventory between stores",
    href: "/stock-transfers",
    icon: "🔄",
  },
  {
    title: "Reports",
    description: "View business reports and analytics",
    href: "/reports",
    icon: "📈",
  },
];

export default function DashboardPage() {
  const supabase = createClient();

  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Business Owner");
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
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
        .select("tenant_id, full_name")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        throw new Error("Tenant information not found.");
      }

      if (profile.full_name) {
        setUserName(profile.full_name);
      }

      const tenantId = profile.tenant_id;

      /* Products */
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(
          "id,name,sku,purchase_price,selling_price,reorder_level,is_active"
        )
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (productsError) throw productsError;

      /* Stores */
      const { count: storesCount, error: storesError } = await supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      if (storesError) throw storesError;

      /* Customers */
      const { count: customersCount, error: customersError } =
        await supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId);

      if (customersError) throw customersError;

      /* Sales */
      const { data: sales, error: salesError } = await supabase
        .from("sales")
        .select("id,total_amount,status,sale_date")
        .eq("tenant_id", tenantId)
        .eq("status", "completed");

      if (salesError) throw salesError;

      /* Sale Items */
      const { data: saleItems, error: saleItemsError } = await supabase
        .from("sale_items")
        .select("product_id,quantity,unit_price,total_price,sale_id")
        .eq("tenant_id", tenantId);

      if (saleItemsError) throw saleItemsError;

      /* Stock Movements */
      const { data: movements, error: movementsError } = await supabase
        .from("stock_movements")
        .select("product_id,quantity")
        .eq("tenant_id", tenantId);

      if (movementsError) throw movementsError;

      /* Calculate current stock */
      const stockMap: Record<string, number> = {};

      (movements || []).forEach((movement) => {
        stockMap[movement.product_id] =
          (stockMap[movement.product_id] || 0) +
          Number(movement.quantity || 0);
      });

      let lowStock = 0;

      (products || []).forEach((product) => {
        const stock = stockMap[product.id] || 0;

        if (
          Number(product.reorder_level || 0) > 0 &&
          stock <= Number(product.reorder_level || 0)
        ) {
          lowStock++;
        }
      });

      /* Today's sales */
      const today = new Date().toISOString().split("T")[0];

      const todaysSales = (sales || []).filter((sale) =>
        String(sale.sale_date).startsWith(today)
      );

      const todaySalesAmount = todaysSales.reduce(
        (sum, sale) => sum + Number(sale.total_amount || 0),
        0
      );

      /* Estimated profit */
      const productCostMap: Record<string, number> = {};

      (products || []).forEach((product) => {
        productCostMap[product.id] = Number(product.purchase_price || 0);
      });

      const saleIds = new Set(todaysSales.map((sale) => sale.id));

      const todaySaleItems = (saleItems || []).filter((item) =>
        saleIds.has(item.sale_id)
      );

      const estimatedCost = todaySaleItems.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity || 0) *
            Number(productCostMap[item.product_id] || 0),
        0
      );

      const estimatedProfit = todaySalesAmount - estimatedCost;

      setStats({
        sales: todaySalesAmount,
        profit: estimatedProfit,
        products: products?.length || 0,
        lowStock,
        stores: storesCount || 0,
        customers: customersCount || 0,
      });
    } catch (err) {
      console.error("Dashboard error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    {
      title: "Today's Sales",
      value: `₹${stats.sales.toLocaleString("en-IN")}`,
      icon: "₹",
      description: "Completed sales today",
      background: "#eef2ff",
      iconBackground: "#4f46e5",
    },
    {
      title: "Estimated Profit",
      value: `₹${stats.profit.toLocaleString("en-IN")}`,
      icon: "↗",
      description: "Estimated from today's sales",
      background: "#ecfdf5",
      iconBackground: "#059669",
    },
    {
      title: "Active Products",
      value: stats.products.toString(),
      icon: "P",
      description: "Products in catalog",
      background: "#eff6ff",
      iconBackground: "#2563eb",
    },
    {
      title: "Low Stock",
      value: stats.lowStock.toString(),
      icon: "!",
      description: "Products at reorder level",
      background: "#fff7ed",
      iconBackground: "#ea580c",
    },
    {
      title: "Active Stores",
      value: stats.stores.toString(),
      icon: "S",
      description: "Operating stores",
      background: "#f5f3ff",
      iconBackground: "#7c3aed",
    },
    {
      title: "Customers",
      value: stats.customers.toString(),
      icon: "C",
      description: "Registered customers",
      background: "#f0fdfa",
      iconBackground: "#0f766e",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#0f172a",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 24px",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              color: "#0f172a",
              fontWeight: 900,
              fontSize: "20px",
            }}
          >
            RetailPilot <span style={{ color: "#4f46e5" }}>AI</span>
          </Link>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              Welcome, {userName}
            </span>

            <button
              onClick={loadDashboard}
              style={{
                background: "#ffffff",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "9px",
                padding: "9px 14px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "28px 24px 50px",
        }}
      >
        {/* Hero */}
        <section
          style={{
            background:
              "linear-gradient(135deg, #111827 0%, #312e81 55%, #4f46e5 100%)",
            borderRadius: "22px",
            padding: "32px",
            color: "#ffffff",
            marginBottom: "24px",
            boxShadow: "0 12px 35px rgba(30,41,59,0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "25px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  opacity: 0.75,
                  marginBottom: "8px",
                }}
              >
                BUSINESS OVERVIEW
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "34px",
                  lineHeight: 1.15,
                  fontWeight: 900,
                }}
              >
                Supermarket Dashboard
              </h1>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "#c7d2fe",
                  fontSize: "15px",
                  maxWidth: "650px",
                }}
              >
                Monitor sales, inventory, customers and business performance
                from one place.
              </p>
            </div>

            <Link
              href="/ai-assistant"
              style={{
                textDecoration: "none",
                background: "#ffffff",
                color: "#312e81",
                padding: "13px 18px",
                borderRadius: "11px",
                fontWeight: 800,
                display: "inline-block",
              }}
            >
              ✨ Ask AI Assistant
            </Link>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#c2410c",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "20px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "28px",
          }}
        >
          {statCards.map((card) => (
            <div
              key={card.title}
              style={{
                background: card.background,
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                padding: "20px",
                minHeight: "130px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#475569",
                      fontWeight: 700,
                    }}
                  >
                    {card.title}
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "28px",
                      color: "#0f172a",
                      fontWeight: 900,
                    }}
                  >
                    {loading ? "..." : card.value}
                  </div>
                </div>

                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "10px",
                    background: card.iconBackground,
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                  }}
                >
                  {card.icon}
                </div>
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                {card.description}
              </div>
            </div>
          ))}
        </section>

        {/* Quick Actions */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            padding: "24px",
            marginBottom: "28px",
          }}
        >
          <h2
            style={{
              margin: "0 0 18px",
              fontSize: "21px",
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            Quick Actions
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
            }}
          >
            <Link
              href="/pos"
              style={{
                textDecoration: "none",
                background: "#4f46e5",
                color: "#ffffff",
                padding: "15px",
                borderRadius: "11px",
                fontWeight: 800,
              }}
            >
              🛒 New Sale
            </Link>

            <Link
              href="/products"
              style={{
                textDecoration: "none",
                background: "#eef2ff",
                color: "#3730a3",
                padding: "15px",
                borderRadius: "11px",
                fontWeight: 800,
              }}
            >
              📦 Manage Products
            </Link>

            <Link
              href="/inventory"
              style={{
                textDecoration: "none",
                background: "#ecfdf5",
                color: "#047857",
                padding: "15px",
                borderRadius: "11px",
                fontWeight: 800,
              }}
            >
              📊 Check Inventory
            </Link>

            <Link
              href="/reports"
              style={{
                textDecoration: "none",
                background: "#eff6ff",
                color: "#1d4ed8",
                padding: "15px",
                borderRadius: "11px",
                fontWeight: 800,
              }}
            >
              📈 View Reports
            </Link>
          </div>
        </section>

        {/* Modules */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "23px",
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                Business Modules
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                Access all RetailPilot management modules.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "16px",
            }}
          >
            {modules.map((module) => (
              <Link
                key={module.title}
                href={module.href}
                style={{
                  textDecoration: "none",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "16px",
                  padding: "20px",
                  color: "#0f172a",
                  display: "block",
                  transition: "transform 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "12px",
                      background: "#eef2ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "22px",
                      flexShrink: 0,
                    }}
                  >
                    {module.icon}
                  </div>

                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "16px",
                        fontWeight: 850,
                        color: "#0f172a",
                      }}
                    >
                      {module.title}
                    </h3>

                    <p
                      style={{
                        margin: "6px 0 0",
                        fontSize: "13px",
                        lineHeight: 1.5,
                        color: "#64748b",
                      }}
                    >
                      {module.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* AI Section */}
        <section
          style={{
            marginTop: "28px",
            background:
              "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            borderRadius: "18px",
            padding: "26px",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#c7d2fe",
                  marginBottom: "6px",
                }}
              >
                INTELLIGENT RETAIL
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "23px",
                  fontWeight: 900,
                }}
              >
                AI Business Assistant
              </h2>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#c7d2fe",
                  fontSize: "14px",
                  maxWidth: "650px",
                }}
              >
                Ask questions about profitability, low stock, supplier
                outstanding and business performance using live database data.
              </p>

              <p
                style={{
                  margin: "12px 0 0",
                  color: "#a5b4fc",
                  fontSize: "12px",
                }}
              >
                AI-generated recommendation • Verify important decisions
                against business records.
              </p>
            </div>

            <Link
              href="/ai-assistant"
              style={{
                textDecoration: "none",
                background: "#ffffff",
                color: "#312e81",
                padding: "13px 18px",
                borderRadius: "10px",
                fontWeight: 800,
              }}
            >
              Open AI Assistant →
            </Link>
          </div>
        </section>

        {/* Footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: "30px",
            color: "#94a3b8",
            fontSize: "12px",
          }}
        >
          RetailPilot AI • Multi-tenant Retail Management SaaS
        </div>
      </div>
    </main>
  );
}