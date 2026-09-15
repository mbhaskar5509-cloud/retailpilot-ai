import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.MCP_SUPABASE_SECRET_KEY!
);

export async function getLowStockProducts(tenantId: string) {
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, sku, category, unit, reorder_level, purchase_price, selling_price"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (productsError) throw productsError;

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("product_id, quantity")
    .eq("tenant_id", tenantId);

  if (movementsError) throw movementsError;

  const stockMap: Record<string, number> = {};

  for (const movement of movements || []) {
    stockMap[movement.product_id] =
      (stockMap[movement.product_id] || 0) +
      Number(movement.quantity || 0);
  }

  return (products || [])
    .map((product) => {
      const currentStock = stockMap[product.id] || 0;
      const reorderLevel = Number(product.reorder_level || 0);

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
    );
}

export async function getProfitability(tenantId: string) {
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, total_amount, status")
    .eq("tenant_id", tenantId)
    .eq("status", "completed");

  if (salesError) throw salesError;

  const { data: saleItems, error: itemsError } = await supabase
    .from("sale_items")
    .select("product_id, quantity, unit_price, total_price")
    .eq("tenant_id", tenantId);

  if (itemsError) throw itemsError;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, purchase_price")
    .eq("tenant_id", tenantId);

  if (productsError) throw productsError;

  const productCostMap: Record<string, number> = {};

  for (const product of products || []) {
    productCostMap[product.id] = Number(product.purchase_price || 0);
  }

  const revenue = (sales || []).reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const completedSaleIds = new Set((sales || []).map((sale) => sale.id));

  const estimatedCost = (saleItems || [])
    .filter((item) => {
      return true;
    })
    .reduce((sum, item) => {
      return (
        sum +
        Number(item.quantity || 0) *
          Number(productCostMap[item.product_id] || 0)
      );
    }, 0);

  const estimatedProfit = revenue - estimatedCost;

  const profitMargin =
    revenue > 0 ? (estimatedProfit / revenue) * 100 : 0;

  return {
    revenue,
    estimated_cost: estimatedCost,
    estimated_profit: estimatedProfit,
    profit_margin: Number(profitMargin.toFixed(2)),
    completed_sales: sales?.length || 0,
  };
}

export async function getDeadStock(tenantId: string) {
  const cutoffDate = new Date();

  cutoffDate.setDate(cutoffDate.getDate() - 60);

  const cutoff = cutoffDate.toISOString();

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, sku, category, unit, purchase_price, selling_price"
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (productsError) throw productsError;

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("product_id, quantity, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (movementsError) throw movementsError;

  const stockMap: Record<string, number> = {};
  const lastMovementMap: Record<string, string> = {};

  for (const movement of movements || []) {
    stockMap[movement.product_id] =
      (stockMap[movement.product_id] || 0) +
      Number(movement.quantity || 0);

    if (!lastMovementMap[movement.product_id]) {
      lastMovementMap[movement.product_id] = movement.created_at;
    }
  }

  return (products || [])
    .map((product) => {
      const currentStock = stockMap[product.id] || 0;
      const lastMovement = lastMovementMap[product.id] || null;

      return {
        ...product,
        current_stock: currentStock,
        last_movement: lastMovement,
      };
    })
    .filter((product) => {
      if (product.current_stock <= 0) return false;

      if (!product.last_movement) return true;

      return product.last_movement < cutoff;
    });
}

export async function getSupplierOutstanding(tenantId: string) {
  const { data: purchases, error } = await supabase
    .from("purchases")
    .select(
      "id, invoice_number, total_amount, payment_status, purchase_date, supplier_id"
    )
    .eq("tenant_id", tenantId);

  if (error) throw error;

  const outstanding = (purchases || []).filter(
    (purchase) =>
      purchase.payment_status !== "paid" &&
      purchase.payment_status !== "completed"
  );

  const outstandingTotal = outstanding.reduce(
    (sum, purchase) => sum + Number(purchase.total_amount || 0),
    0
  );

  return {
    outstanding_total: outstandingTotal,
    count: outstanding.length,
    purchases: outstanding,
  };
}

export async function generateBusinessReport(tenantId: string) {
  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, total_amount, status, sale_date")
    .eq("tenant_id", tenantId);

  if (salesError) throw salesError;

  const completedSales = (sales || []).filter(
    (sale) => sale.status === "completed"
  );

  const revenue = completedSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("amount")
    .eq("tenant_id", tenantId);

  if (expensesError) throw expensesError;

  const totalExpenses = (expenses || []).reduce(
    (sum, expense) => sum + Number(expense.amount || 0),
    0
  );

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, reorder_level")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (productsError) throw productsError;

  const { data: movements, error: movementsError } = await supabase
    .from("stock_movements")
    .select("product_id, quantity")
    .eq("tenant_id", tenantId);

  if (movementsError) throw movementsError;

  const stockMap: Record<string, number> = {};

  for (const movement of movements || []) {
    stockMap[movement.product_id] =
      (stockMap[movement.product_id] || 0) +
      Number(movement.quantity || 0);
  }

  const lowStockProducts = (products || []).filter((product) => {
    const currentStock = stockMap[product.id] || 0;
    const reorderLevel = Number(product.reorder_level || 0);

    return reorderLevel > 0 && currentStock <= reorderLevel;
  });

  return {
    completed_sales: completedSales.length,
    revenue,
    expenses: totalExpenses,
    net_position: revenue - totalExpenses,
    active_products: products?.length || 0,
    low_stock_products: lowStockProducts.length,
    disclaimer:
      "AI-generated recommendation. Verify important decisions against business records.",
  };
}