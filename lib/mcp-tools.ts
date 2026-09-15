import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.MCP_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key);
}

export async function getProfitability(tenantId: string) {
  const supabase = getSupabase();

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, total_amount, status")
    .eq("tenant_id", tenantId)
    .eq("status", "completed");

  if (salesError) {
    throw salesError;
  }

  const { data: saleItems, error: itemsError } = await supabase
    .from("sale_items")
    .select("product_id, quantity, unit_price")
    .eq("tenant_id", tenantId);

  if (itemsError) {
    throw itemsError;
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, purchase_price")
    .eq("tenant_id", tenantId);

  if (productsError) {
    throw productsError;
  }

  const revenue = (sales ?? []).reduce(
    (sum, sale) => sum + Number(sale.total_amount ?? 0),
    0
  );

  const productCostMap = new Map(
    (products ?? []).map((product) => [
      product.id,
      Number(product.purchase_price ?? 0),
    ])
  );

  const estimatedCost = (saleItems ?? []).reduce((sum, item) => {
    const purchasePrice = productCostMap.get(item.product_id) ?? 0;
    return sum + purchasePrice * Number(item.quantity ?? 0);
  }, 0);

  const estimatedProfit = revenue - estimatedCost;

  const profitMargin =
    revenue > 0 ? (estimatedProfit / revenue) * 100 : 0;

  return {
    revenue: Number(revenue.toFixed(2)),
    estimated_cost: Number(estimatedCost.toFixed(2)),
    estimated_profit: Number(estimatedProfit.toFixed(2)),
    profit_margin: Number(profitMargin.toFixed(2)),
    currency: "INR",
    disclaimer: "AI-generated recommendation. Verify important business decisions.",
  };
}

export async function getLowStockProducts(tenantId: string) {
  const supabase = getSupabase();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, sku, category, unit, purchase_price, selling_price, reorder_level, is_active"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (productsError) {
    throw productsError;
  }

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("product_id, quantity")
    .eq("tenant_id", tenantId);

  if (movementsError) {
    throw movementsError;
  }

  const stockMap = new Map<string, number>();

  for (const movement of movements ?? []) {
    const current = stockMap.get(movement.product_id) ?? 0;
    stockMap.set(
      movement.product_id,
      current + Number(movement.quantity ?? 0)
    );
  }

  const lowStock = (products ?? [])
    .map((product) => {
      const currentStock = stockMap.get(product.id) ?? 0;
      const reorderLevel = Number(product.reorder_level ?? 0);

      return {
        ...product,
        current_stock: currentStock,
        reorder_level: reorderLevel,
      };
    })
    .filter(
      (product) =>
        product.reorder_level > 0 &&
        product.current_stock <= product.reorder_level
    )
    .sort((a, b) => a.current_stock - b.current_stock);

  return {
    count: lowStock.length,
    products: lowStock,
    disclaimer: "AI-generated recommendation. Verify important business decisions.",
  };
}

export async function getSupplierOutstanding(tenantId: string) {
  const supabase = getSupabase();

  const { data: purchases, error } = await supabase
    .from("purchases")
    .select(
      "id, supplier_id, invoice_number, purchase_date, total_amount, payment_status, suppliers(name)"
    )
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  const outstanding = (purchases ?? []).filter((purchase) => {
    const status = String(purchase.payment_status ?? "").toLowerCase();

    return (
      status === "pending" ||
      status === "unpaid" ||
      status === "partial" ||
      status === "due"
    );
  });

  const outstandingTotal = outstanding.reduce(
    (sum, purchase) => sum + Number(purchase.total_amount ?? 0),
    0
  );

  return {
    count: outstanding.length,
    outstanding_total: Number(outstandingTotal.toFixed(2)),
    currency: "INR",
    purchases: outstanding,
    disclaimer: "AI-generated recommendation. Verify important business decisions.",
  };
}

export async function generateBusinessReport(tenantId: string) {
  const supabase = getSupabase();

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, total_amount, status, sale_date")
    .eq("tenant_id", tenantId)
    .eq("status", "completed");

  if (salesError) {
    throw salesError;
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, reorder_level, is_active")
    .eq("tenant_id", tenantId);

  if (productsError) {
    throw productsError;
  }

  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("amount, expense_date")
    .eq("tenant_id", tenantId);

  if (expensesError) {
    throw expensesError;
  }

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("product_id, quantity")
    .eq("tenant_id", tenantId);

  if (movementsError) {
    throw movementsError;
  }

  const revenue = (sales ?? []).reduce(
    (sum, sale) => sum + Number(sale.total_amount ?? 0),
    0
  );

  const expenseTotal = (expenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );

  const stockMap = new Map<string, number>();

  for (const movement of movements ?? []) {
    const current = stockMap.get(movement.product_id) ?? 0;
    stockMap.set(
      movement.product_id,
      current + Number(movement.quantity ?? 0)
    );
  }

  const lowStockCount = (products ?? []).filter((product) => {
    const stock = stockMap.get(product.id) ?? 0;
    const reorderLevel = Number(product.reorder_level ?? 0);

    return reorderLevel > 0 && stock <= reorderLevel;
  }).length;

  return {
    completed_sales: sales?.length ?? 0,
    revenue: Number(revenue.toFixed(2)),
    expenses: Number(expenseTotal.toFixed(2)),
    net_position: Number((revenue - expenseTotal).toFixed(2)),
    active_products: (products ?? []).filter(
      (product) => product.is_active
    ).length,
    low_stock_products: lowStockCount,
    currency: "INR",
    disclaimer: "AI-generated recommendation. Verify important business decisions.",
  };
}

export async function getDeadStock(tenantId: string) {
  const supabase = getSupabase();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, sku, category, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (productsError) {
    throw productsError;
  }

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("product_id, quantity, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (movementsError) {
    throw movementsError;
  }

  const latestMovement = new Map<string, string>();

  for (const movement of movements ?? []) {
    if (!latestMovement.has(movement.product_id)) {
      latestMovement.set(movement.product_id, movement.created_at);
    }
  }

  const deadStock = (products ?? []).filter((product) => {
    const lastMovement = latestMovement.get(product.id);

    if (!lastMovement) {
      return true;
    }

    return new Date(lastMovement) < cutoff;
  });

  return {
    count: deadStock.length,
    cutoff_date: cutoff.toISOString(),
    products: deadStock,
    disclaimer: "AI-generated recommendation. Verify important business decisions.",
  };
}