import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEAD_STOCK_DAYS = 60;

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
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
        {
          success: false,
          error: "Tenant not found",
        },
        { status: 400 }
      );
    }

    const tenantId = profile.tenant_id;

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku, selling_price, is_active")
      .eq("tenant_id", tenantId)
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
      .select(
        "product_id, quantity, movement_type, created_at"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", {
        ascending: false,
      });

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
    const latestMovementByProduct = new Map<string, string>();

    for (const movement of movements ?? []) {
      const currentStock =
        stockByProduct.get(movement.product_id) ?? 0;

      stockByProduct.set(
        movement.product_id,
        currentStock + Number(movement.quantity ?? 0)
      );

      if (!latestMovementByProduct.has(movement.product_id)) {
        latestMovementByProduct.set(
          movement.product_id,
          movement.created_at
        );
      }
    }

    const cutoffDate = new Date(
      Date.now() -
        DEAD_STOCK_DAYS * 24 * 60 * 60 * 1000
    );

    const deadStockProducts = (products ?? [])
      .map((product) => {
        const currentStock =
          stockByProduct.get(product.id) ?? 0;

        const latestMovement =
          latestMovementByProduct.get(product.id) ?? null;

        const latestMovementDate = latestMovement
          ? new Date(latestMovement)
          : null;

        const daysSinceMovement = latestMovementDate
          ? Math.floor(
              (Date.now() - latestMovementDate.getTime()) /
                (24 * 60 * 60 * 1000)
            )
          : null;

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          current_stock: currentStock,
          selling_price: Number(
            product.selling_price ?? 0
          ),
          latest_movement_at: latestMovement,
          days_since_movement: daysSinceMovement,
          estimated_stock_value:
            currentStock *
            Number(product.selling_price ?? 0),
        };
      })
      .filter((product) => {
        if (product.current_stock <= 0) {
          return false;
        }

        if (!product.latest_movement_at) {
          return false;
        }

        return (
          new Date(product.latest_movement_at) <=
          cutoffDate
        );
      });

    return NextResponse.json({
      success: true,
      automation: "dead_stock_audit",
      checked_at: new Date().toISOString(),
      threshold_days: DEAD_STOCK_DAYS,
      cutoff_date: cutoffDate.toISOString(),
      dead_stock_count: deadStockProducts.length,
      products: deadStockProducts,
      message:
        deadStockProducts.length > 0
          ? "Dead stock detected. Review slow-moving inventory and consider appropriate action."
          : "No dead stock detected.",
      disclaimer:
        "AI-generated recommendation. Verify inventory data before taking action.",
    });
  } catch (error) {
    console.error(
      "Dead stock automation error:",
      error
    );

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