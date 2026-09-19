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
      .select("total_amount, status, created_at")
      .eq("tenant_id", tenantId);

    if (salesError) {
      return NextResponse.json(
        { success: false, error: salesError.message },
        { status: 500 }
      );
    }

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("amount, created_at")
      .eq("tenant_id", tenantId);

    if (expensesError) {
      return NextResponse.json(
        { success: false, error: expensesError.message },
        { status: 500 }
      );
    }

    const now = new Date();

    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const monthlySales = (sales ?? []).filter(
      (sale) =>
        new Date(sale.created_at) >= monthStart &&
        sale.status === "completed"
    );

    const monthlyExpenses = (expenses ?? []).filter(
      (expense) =>
        new Date(expense.created_at) >= monthStart
    );

    const revenue = monthlySales.reduce(
      (sum, sale) => sum + Number(sale.total_amount ?? 0),
      0
    );

    const totalExpenses = monthlyExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount ?? 0),
      0
    );

    const netPosition = revenue - totalExpenses;

    return NextResponse.json({
      success: true,
      automation: "monthly_executive_ai_report",
      generated_at: new Date().toISOString(),
      month: `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`,
      metrics: {
        transactions: monthlySales.length,
        revenue,
        expenses: totalExpenses,
        net_position: netPosition,
      },
      summary:
        netPosition >= 0
          ? "Monthly revenue is currently higher than recorded expenses."
          : "Recorded monthly expenses are currently higher than revenue.",
      recommendation:
        netPosition >= 0
          ? "Review revenue trends, expenses and inventory performance for continued growth."
          : "Review major expenses, sales performance and inventory efficiency.",
      disclaimer:
        "AI-generated recommendation. Verify business data before taking action.",
    });
  } catch (error) {
    console.error("Monthly report automation error:", error);

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