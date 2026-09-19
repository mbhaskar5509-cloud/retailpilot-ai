import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "Tenant not found" },
        { status: 400 }
      );
    }

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(
        "id, name, sku, reorder_level, is_active"
      )
      .eq("tenant_id", profile.tenant_id)
      .eq("is_active", true)
      .order("name");

    if (productsError) {
      return NextResponse.json(
        {
          success: false,
          error: productsError.message,
        },
        { status: 500 }
      );
    }

    const { data: movements, error: movementsError } = await supabase
      .from("stock_movements")
      .select("product_id, quantity")
      .eq("tenant_id", profile.tenant_id);

    if (movementsError) {
      return NextResponse.json(
        {
          success: false,
          error: movementsError.message,
        },
        { status: 500 }
      );
    }

    const stockByProduct = new Map<string, number>();

    for (const movement of movements ?? []) {
      const current = stockByProduct.get(movement.product_id) ?? 0;
      stockByProduct.set(
        movement.product_id,
        current + Number(movement.quantity ?? 0)
      );
    }

    const lowStockProducts = (products ?? [])
      .map((product) => {
        const currentStock =
          stockByProduct.get(product.id) ?? 0;

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          current_stock: currentStock,
          reorder_level: Number(product.reorder_level ?? 0),
        };
      })
      .filter(
        (product) =>
          product.current_stock <= product.reorder_level
      );

    return NextResponse.json({
      success: true,
      automation: "low_stock_alert",
      checked_at: new Date().toISOString(),
      low_stock_count: lowStockProducts.length,
      products: lowStockProducts,
      message:
        lowStockProducts.length > 0
          ? "Low stock products detected. Reorder recommended."
          : "No low stock products detected.",
      disclaimer:
        "AI-generated recommendation. Verify inventory data before taking action.",
    });
  } catch (error) {
    console.error("Low stock automation error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}