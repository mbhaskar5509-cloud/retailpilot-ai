import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.MCP_SUPABASE_SECRET_KEY;
const tenantId = process.env.MCP_TENANT_ID;

if (!supabaseUrl || !supabaseKey || !tenantId) {
  throw new Error(
    "Supabase URL, MCP secret key, or MCP tenant ID is missing."
  );
}

// This client is ONLY used by the server-side MCP process.
// Never expose MCP_SUPABASE_SECRET_KEY to the browser.
const supabase = createClient(supabaseUrl, supabaseKey);

const server = new McpServer({
  name: "retailpilot-ai-mcp",
  version: "1.0.0",
});

server.tool(
  "get_low_stock_products",
  "Find active products whose current stock is at or below the reorder level.",
  {},
  async () => {
    const { data: products, error: productError } = await supabase
      .from("products")
      .select(
        "id, name, sku, category, unit, purchase_price, selling_price, reorder_level"
      )
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name");

    if (productError) {
      return {
        content: [
          {
            type: "text",
            text: `Product query error: ${productError.message}`,
          },
        ],
      };
    }

    const { data: movements, error: movementError } = await supabase
      .from("stock_movements")
      .select("product_id, movement_type, quantity")
      .eq("tenant_id", tenantId);

    if (movementError) {
      return {
        content: [
          {
            type: "text",
            text: `Stock movement query error: ${movementError.message}`,
          },
        ],
      };
    }

    const stockByProduct: Record<string, number> = {};

    for (const movement of movements ?? []) {
      const productId = movement.product_id;
      const quantity = Number(movement.quantity) || 0;

      if (!stockByProduct[productId]) {
        stockByProduct[productId] = 0;
      }

      stockByProduct[productId] += quantity;
    }

    const lowStockProducts = (products ?? [])
      .map((product) => {
        const currentStock = stockByProduct[product.id] ?? 0;
        const reorderLevel = Number(product.reorder_level) || 0;

        return {
          ...product,
          current_stock: currentStock,
          reorder_level: reorderLevel,
          status:
            currentStock <= reorderLevel ? "LOW_STOCK" : "HEALTHY",
        };
      })
      .filter((product) => product.current_stock <= product.reorder_level);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              tool: "get_low_stock_products",
              tenant_id: tenantId,
              generated_at: new Date().toISOString(),
              count: lowStockProducts.length,
              products: lowStockProducts,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_dead_stock",
  "Find active products with no recent sales.",
  {},
  async () => {
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, sku, category, selling_price")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name");

    if (productError) {
      return {
        content: [
          {
            type: "text",
            text: `Product query error: ${productError.message}`,
          },
        ],
      };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);

    const { data: recentSales, error: salesError } = await supabase
      .from("sale_items")
      .select(
        "product_id, sales!inner(sale_date, tenant_id, status)"
      )
      .eq("sales.tenant_id", tenantId)
      .eq("sales.status", "completed")
      .gte("sales.sale_date", cutoff.toISOString());

    if (salesError) {
      return {
        content: [
          {
            type: "text",
            text: `Sales query error: ${salesError.message}`,
          },
        ],
      };
    }

    const recentlySold = new Set(
      (recentSales ?? []).map((item) => item.product_id)
    );

    const deadStock = (products ?? [])
      .filter((product) => !recentlySold.has(product.id))
      .map((product) => ({
        ...product,
        stagnant_days: 60,
        recommendation:
          "Consider markdown, promotion, bundle offer, or liquidation.",
      }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              tool: "get_dead_stock",
              tenant_id: tenantId,
              cutoff_date: cutoff.toISOString(),
              count: deadStock.length,
              products: deadStock,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_profitability",
  "Calculate actual sales revenue, estimated cost, and profit.",
  {},
  async () => {
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("id, total_amount, status")
      .eq("tenant_id", tenantId)
      .eq("status", "completed");

    if (salesError) {
      return {
        content: [
          {
            type: "text",
            text: `Sales query error: ${salesError.message}`,
          },
        ],
      };
    }

    const { data: saleItems, error: itemsError } = await supabase
      .from("sale_items")
      .select(
        "product_id, quantity, unit_price, total_price, products!inner(name, purchase_price)"
      )
      .eq("tenant_id", tenantId);

    if (itemsError) {
      return {
        content: [
          {
            type: "text",
            text: `Sale items query error: ${itemsError.message}`,
          },
        ],
      };
    }

    const revenue = (sales ?? []).reduce(
      (sum, sale) => sum + Number(sale.total_amount || 0),
      0
    );

    const estimatedCost = (saleItems ?? []).reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0) *
          Number(
            (item.products as { purchase_price?: number } | null)
              ?.purchase_price || 0
          ),
      0
    );

    const profit = revenue - estimatedCost;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              tool: "get_profitability",
              tenant_id: tenantId,
              revenue,
              estimated_cost: estimatedCost,
              estimated_profit: profit,
              profit_margin:
                revenue > 0 ? Number(((profit / revenue) * 100).toFixed(2)) : 0,
              note: "Profitability is calculated from completed sales and product purchase cost.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_supplier_outstanding",
  "Get outstanding supplier purchase amounts.",
  {},
  async () => {
    const { data: purchases, error } = await supabase
      .from("purchases")
      .select(
        "id, invoice_number, purchase_date, total_amount, payment_status, supplier_id, suppliers(name)"
      )
      .eq("tenant_id", tenantId)
      .in("payment_status", ["pending", "partial"]);

    if (error) {
      return {
        content: [
          {
            type: "text",
            text: `Purchase query error: ${error.message}`,
          },
        ],
      };
    }

    const outstandingTotal = (purchases ?? []).reduce(
      (sum, purchase) => sum + Number(purchase.total_amount || 0),
      0
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              tool: "get_supplier_outstanding",
              tenant_id: tenantId,
              outstanding_total: outstandingTotal,
              count: purchases?.length ?? 0,
              purchases: purchases ?? [],
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "generate_business_report",
  "Generate a consolidated business report using live tenant data.",
  {},
  async () => {
    const [
      salesResult,
      expensesResult,
      productsResult,
      movementsResult,
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("id, total_amount, status, sale_date")
        .eq("tenant_id", tenantId)
        .eq("status", "completed"),

      supabase
        .from("expenses")
        .select("amount, expense_date")
        .eq("tenant_id", tenantId),

      supabase
        .from("products")
        .select("id, name, sku, reorder_level")
        .eq("tenant_id", tenantId)
        .eq("is_active", true),

      supabase
        .from("stock_movements")
        .select("product_id, quantity")
        .eq("tenant_id", tenantId),
    ]);

    if (salesResult.error) {
      throw new Error(`Sales query error: ${salesResult.error.message}`);
    }

    if (expensesResult.error) {
      throw new Error(
        `Expenses query error: ${expensesResult.error.message}`
      );
    }

    if (productsResult.error) {
      throw new Error(
        `Products query error: ${productsResult.error.message}`
      );
    }

    if (movementsResult.error) {
      throw new Error(
        `Stock movement query error: ${movementsResult.error.message}`
      );
    }

    const revenue = (salesResult.data ?? []).reduce(
      (sum, sale) => sum + Number(sale.total_amount || 0),
      0
    );

    const expenses = (expensesResult.data ?? []).reduce(
      (sum, expense) => sum + Number(expense.amount || 0),
      0
    );

    const stockByProduct: Record<string, number> = {};

    for (const movement of movementsResult.data ?? []) {
      stockByProduct[movement.product_id] =
        (stockByProduct[movement.product_id] ?? 0) +
        Number(movement.quantity || 0);
    }

    const lowStock = (productsResult.data ?? []).filter(
      (product) =>
        (stockByProduct[product.id] ?? 0) <=
        Number(product.reorder_level || 0)
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              tool: "generate_business_report",
              tenant_id: tenantId,
              generated_at: new Date().toISOString(),
              summary: {
                completed_sales: salesResult.data?.length ?? 0,
                revenue,
                expenses,
                net_position: revenue - expenses,
                active_products: productsResult.data?.length ?? 0,
                low_stock_products: lowStock.length,
              },
              low_stock_products: lowStock.map((product) => ({
                name: product.name,
                sku: product.sku,
                current_stock: stockByProduct[product.id] ?? 0,
                reorder_level: Number(product.reorder_level || 0),
              })),
              disclaimer:
                "AI-generated recommendation. Verify business decisions against live records.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

async function startServer() {
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

startServer().catch((error) => {
  console.error("MCP SERVER ERROR:");
  console.error(error);
  process.exit(1);
});