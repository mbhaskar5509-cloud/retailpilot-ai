import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

import {
  getProfitability,
  getLowStockProducts,
  getSupplierOutstanding,
  generateBusinessReport,
} from "@/lib/mcp-tools";

export const dynamic = "force-dynamic";

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.MCP_SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(url, key);
}

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  return new GoogleGenAI({ apiKey });
}

export async function POST(request: Request) {
  try {
    const supabase = getServerSupabase();

    const body = await request.json();
    const question = String(body?.question || "").trim();

    if (!question) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: "User tenant information was not found." },
        { status: 400 }
      );
    }

    const tenantId = profile.tenant_id;

    const normalizedQuestion = question.toLowerCase();

    let toolUsed = "generate_business_report";
    let liveData: unknown;

    if (
      normalizedQuestion.includes("profit") ||
      normalizedQuestion.includes("profitability") ||
      normalizedQuestion.includes("margin")
    ) {
      toolUsed = "get_profitability";
      liveData = await getProfitability(tenantId);
    } else if (
      normalizedQuestion.includes("low stock") ||
      normalizedQuestion.includes("low-stock") ||
      normalizedQuestion.includes("reorder") ||
      normalizedQuestion.includes("stock alert")
    ) {
      toolUsed = "get_low_stock_products";
      liveData = await getLowStockProducts(tenantId);
    } else if (
      normalizedQuestion.includes("supplier") ||
      normalizedQuestion.includes("outstanding") ||
      normalizedQuestion.includes("payment due")
    ) {
      toolUsed = "get_supplier_outstanding";
      liveData = await getSupplierOutstanding(tenantId);
    } else {
      toolUsed = "generate_business_report";
      liveData = await generateBusinessReport(tenantId);
    }

    const ai = getGemini();

    const prompt = `
You are the AI business assistant for RetailPilot AI, a supermarket management system.

User question:
${question}

Live database tool used:
${toolUsed}

Live database result:
${JSON.stringify(liveData, null, 2)}

Rules:
1. Use ONLY the live database result above.
2. Never invent, estimate, or assume business numbers.
3. Do not claim information that is not present in the live result.
4. Use Indian Rupees (₹) for money.
5. Give a concise, practical answer.
6. If useful, provide a short recommendation based only on the live data.
7. Clearly mention "AI-generated recommendation" when giving a recommendation.
8. If the requested information is unavailable in the live result, say that it is unavailable.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const answer =
      response.text?.trim() ||
      "I could not generate an answer from the available live data.";

    return NextResponse.json({
      success: true,
      answer,
      toolUsed,
      liveData,
      disclaimer: "AI-generated recommendation. Verify important business decisions.",
    });
  } catch (error) {
    console.error("AI Assistant API error:", error);

    return NextResponse.json(
      {
        error: "Unable to process your request.",
      },
      { status: 500 }
    );
  }
}