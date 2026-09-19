import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "Tenant not found" },
        { status: 400 }
      );
    }

    const { data: suppliers, error } = await supabase
      .from("suppliers")
      .select("id, name, phone, email")
      .eq("tenant_id", profile.tenant_id)
      .order("name");

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      automation: "supplier_payment_escalation",
      checked_at: new Date().toISOString(),
      supplier_count: suppliers?.length ?? 0,
      suppliers: suppliers ?? [],
      message:
        "Supplier payment escalation check completed. Verify supplier payment due dates before taking action.",
      disclaimer:
        "AI-generated recommendation. Verify supplier payment information before taking action.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error",
      },
      { status: 500 }
    );
  }
}