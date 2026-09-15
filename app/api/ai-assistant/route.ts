import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { createClient } from "@/lib/supabase/server";
import {
  getProfitability,
  getLowStockProducts,
  getSupplierOutstanding,
  generateBusinessReport,
} from "@/lib/mcp-tools";

export async function POST(request: Request) {
  try {
    // 1. Read user message
    const body = await request.json();
    const message = body?.message?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Please enter a question." },
        { status: 400 }
      );
    }

    // 2. Create Supabase server client
    const supabase = await createClient();

    // 3. Check logged-in user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      throw new Error(`Authentication error: ${authError.message}`);
    }

    if (!user) {
      return NextResponse.json(
        { error: "Please login first." },
        { status: 401 }
      );
    }

    // 4. Get user's tenant
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new Error(
        `User profile error: ${profileError.message}`
      );
    }

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { error: "No business/tenant found for this user." },
        { status: 400 }
      );
    }

    const tenantId = profile.tenant_id;

    // 5. Decide which live MCP-style tool to use
    const lowerMessage = message.toLowerCase();

    let toolUsed = "";
    let liveData: unknown;

    if (
      lowerMessage.includes("profit") ||
      lowerMessage.includes("profitability")
    ) {
      toolUsed = "get_profitability";
      liveData = await getProfitability(tenantId);
    } else if (
      lowerMessage.includes("low stock") ||
      lowerMessage.includes("low-stock") ||
      lowerMessage.includes("reorder") ||
      lowerMessage.includes("stock")
    ) {
      toolUsed = "get_low_stock_products";
      liveData = await getLowStockProducts(tenantId);
    } else if (
      lowerMessage.includes("supplier") ||
      lowerMessage.includes("outstanding") ||
      lowerMessage.includes("payment due")
    ) {
      toolUsed = "get_supplier_outstanding";
      liveData = await getSupplierOutstanding(tenantId);
    } else {
      toolUsed = "generate_business_report";
      liveData = await generateBusinessReport(tenantId);
    }

    // 6. Check Gemini API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is missing in .env.local"
      );
    }

    // 7. Connect to Gemini
    const ai = new GoogleGenAI({
      apiKey,
    });

    // 8. Ask Gemini to explain ONLY the live database result
    const prompt = `
You are the AI business assistant for RetailPilot AI.

User question:
${message}

Live database tool:
${toolUsed}

Live database result:
${JSON.stringify(liveData, null, 2)}

Rules:
- Use ONLY the live database result provided above.
- Never invent numbers.
- Never guess missing information.
- Use Indian Rupees (₹) when money is involved.
- Keep the answer concise and professional.
- Explain the result in simple language.
- If appropriate, give one short business recommendation.
- Clearly mention that this is an AI-generated recommendation.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const answer =
      response.text ||
      "I received the live business data, but could not generate a response.";

    // 9. Return response to frontend
    return NextResponse.json({
      success: true,
      answer,
      toolUsed,
      liveData,
      disclaimer: "AI-generated recommendation",
    });
  } catch (error) {
    console.error("AI Assistant API error:", error);

    return NextResponse.json(
      {
        error: "Unable to process your request.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}