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

    const tenantId = profile.tenant_id;

    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select("id, total_amount, status, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (salesError) {
      return NextResponse.json(
        { success: false, error: salesError.message },
        { status: 500 }
      );
    }

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const todaySales = (sales ?? []).filter(
      (sale) => new Date(sale.created_at) >= startOfDay
    );

    const completedSales = todaySales.filter(
      (sale) => sale.status === "completed"
    );

    const totalSales = completedSales.reduce(
      (sum, sale) => sum + Number(sale.total_amount ?? 0),
      0
    );

    const averageTransactionValue =
      completedSales.length > 0
        ? totalSales / completedSales.length
        : 0;

    return NextResponse.json({
      success: true,
      automation: "daily_eod_sales_dossier",
      generated_at: new Date().toISOString(),
      date: today.toISOString().split("T")[0],
      total_transactions: completedSales.length,
      total_sales: totalSales,
      average_transaction_value: averageTransactionValue,
      message:
        completedSales.length > 0
          ? "Daily EOD sales dossier generated successfully."
          : "No completed sales recorded today.",
      disclaimer:
        "AI-generated recommendation. Verify sales and payment data before taking action.",
    });
  } catch (error) {
    console.error("EOD sales automation error:", error);

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