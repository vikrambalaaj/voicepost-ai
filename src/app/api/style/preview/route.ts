import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { buildSystemPrompt } from "@/app/api/content/generate/route";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { style_json, topic } = body;

    const userId = await getAuthenticatedUserId(req);
    let user: any = null;
    if (userId) {
      const { data } = await db.from("users").select("id, plan").eq("id", userId).single();
      user = data;
    }
    if (!user) {
      user = { id: "00000000-0000-0000-0000-000000000000", plan: "free" };
    }

    const style = style_json || {
      avg_post_length_words: 100,
      tone_descriptor: "authoritative, educational",
      uses_emojis: false,
      uses_line_breaks_for_drama: true,
    };

    const targetTopic = topic || "Focus and speed in building startups";

    const prompt = `Write a short example LinkedIn post demonstrating the style specified below.
Topic to write about: "${targetTopic}"

STYLE SPECIFICATION:
${JSON.stringify(style, null, 2)}

Rules:
1. Make it brief (50-100 words).
2. Adhere strictly to the spacing, emojis, and tone.
3. Return ONLY the text of the sample post. No preamble, no quotes.`;

    const llmRes = await routeLLMRequest({
      useCase: "style_preview",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: prompt }
      ],
      userId: user.id,
      userPlan: user.plan as any,
      sessionId: "style-preview-" + Date.now(),
    });

    return NextResponse.json({
      success: true,
      sample_post: llmRes.content.trim().replace(/^"|"$/g, ""),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
