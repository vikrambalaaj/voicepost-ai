import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { BANNED_WORDS } from "../../content/generate/route";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { transcript, post_content, comment_text } = body;

    if (!transcript || !post_content || !comment_text) {
      return NextResponse.json({ error: "transcript, post_content, and comment_text are required" }, { status: 400 });
    }

    // 1. Fetch user to check plan details
    const { data: user } = await db.from("users").select("id, plan").eq("id", userId).single();
    const userPlan = user?.plan || "pro";

    // 2. Fetch style profile
    const { data: profile } = await db.from("style_profiles").select("style_json").eq("user_id", userId).single();
    const styleJson = profile?.style_json || {
      tone_descriptor: "authoritative, urgent, professional",
      uses_emojis: false,
      emoji_frequency: "none",
      avoided_corporate_words: ["delve", "leverage", "cutting-edge"]
    };

    // 3. Construct System Instructions for voice comment rewriting
    const systemPrompt = `You are a professional ghostwriter. Your job is to rewrite a raw, spoken comment reply transcript into a highly polished, natural-sounding LinkedIn reply.

POST CONTEXT:
"${post_content}"

COMMENT RECEIVED:
"${comment_text}"

RAW SPOKEN TRANSCRIPT (TO REWRITE):
"${transcript}"

STYLE DNA INSTRUCTIONS:
- Tone: ${styleJson.tone_descriptor || "professional"}
- Avoid these words: ${[...BANNED_WORDS, ...(styleJson.avoided_corporate_words || [])].join(", ")}
- Emoji preference: ${styleJson.uses_emojis ? `Include 1 emoji if natural` : "Strictly no emojis"}

CRITICAL RULES:
1. Synthesize the raw transcript. Remove vocal fillers ("uh", "um", "like", "you know"), grammatical hiccups, and repetitive phrasing.
2. Keep the response concise, punchy, and direct (under 25-30 words).
3. Do NOT make the reply sound like standard marketing AI copy. Write like a real person reacting naturally.
4. Return ONLY the plain text of the rewritten reply. Do not include markdown quotes, introductory phrases, or explanations.`;

    // 4. Query LLM Router
    const llmRes = await routeLLMRequest({
      useCase: "transcript_correction",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Rewrite the spoken transcript into a reply." }
      ],
      userId: userId,
      userPlan: userPlan as any,
      sessionId: "comment-reply-rewriting-" + Date.now(),
    });

    let rewrittenReply = llmRes.content.trim();
    // Clean outer quotes or markdown formatting if any bled through
    rewrittenReply = rewrittenReply.replace(/^["'`]|["'`]$/g, "").trim();

    return NextResponse.json({
      success: true,
      rewritten_reply: rewrittenReply,
      provider: llmRes.provider,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Rewriting voice reply failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
