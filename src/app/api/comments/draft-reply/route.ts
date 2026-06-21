import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { cleanJsonString } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { post_content, comment_text, thread_history } = body;

    if (!post_content || !comment_text) {
      return NextResponse.json({ error: "post_content and comment_text are required" }, { status: 400 });
    }

    // 1. Fetch user to check plan details
    const { data: user } = await db.from("users").select("id, plan").eq("id", userId).single();
    const userPlan = user?.plan || "pro";

    // 2. Fetch user's Style DNA Profile
    const { data: profile } = await db.from("style_profiles").select("style_json").eq("user_id", userId).single();
    const styleJson = profile?.style_json || {
      tone_descriptor: "authoritative, urgent, professional",
      uses_emojis: false,
      emoji_frequency: "none",
      avoided_corporate_words: ["delve", "leverage", "cutting-edge"]
    };

    let chatHistoryPrompt = "";
    if (thread_history && Array.isArray(thread_history) && thread_history.length > 0) {
      chatHistoryPrompt = "CHAT HISTORY SO FAR:\n" + thread_history.map((r: any) => `- ${r.commenter_name}: "${r.comment_text}"`).join("\n");
    }

    // 3. Construct System Instructions
    const systemPrompt = `You are a professional LinkedIn ghostwriter and engagement strategist.
Draft exactly three distinct, high-impact reply options to a comment thread left on your client's LinkedIn post.

POST CONTEXT:
"${post_content}"

PARENT COMMENT:
"${comment_text}"

${chatHistoryPrompt ? `${chatHistoryPrompt}\n` : ""}
CLIENT'S WRITING TONE & STYLE (STYLE DNA):
- Tone: ${styleJson.tone_descriptor || "professional"}
- Avoid these corporate words: ${(styleJson.avoided_corporate_words || []).join(", ") || "none"}
- Emoji usage: ${styleJson.uses_emojis ? `Match ${styleJson.emoji_frequency || "low"} frequency` : "Strictly no emojis"}

CRITICAL RULES:
1. Replies must be concise (under 25 words).
2. Avoid any generic AI filler phrases.
3. Every option must be a unique reply style:
   - Option 1: Short & Punchy (validation or simple agreement).
   - Option 2: Value-Add (brief insight that adds onto their comment).
   - Option 3: Question-based (brief follow-up question to keep the comment thread active).
4. Return ONLY a valid raw JSON array containing exactly three strings. Do not wrap in markdown backticks.

OUTPUT SCHEMA EXAMPLE:
["Option 1 text...", "Option 2 text...", "Option 3 text..."]`;

    // 4. Query LLM Router
    const llmRes = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the three comment reply options." }
      ],
      userId: userId,
      userPlan: userPlan as any,
      sessionId: "comment-reply-drafting-" + Date.now(),
      responseFormat: "json",
    });

    let options: string[] = [];
    try {
      options = JSON.parse(cleanJsonString(llmRes.content));
    } catch (e) {
      // RegEx fallback
      const match = llmRes.content.match(/\[[\s\S]*\]/);
      if (match) {
        options = JSON.parse(cleanJsonString(match[0]));
      } else {
        throw new Error("Failed to parse reply options JSON: " + llmRes.content);
      }
    }

    if (!Array.isArray(options) || options.length === 0) {
      options = [
        "Thanks for sharing your perspective on this!",
        "That is a great point. How are you currently handling this in your team?",
        "Exactly. Scaling this effectively requires a structured approach."
      ];
    }

    return NextResponse.json({
      success: true,
      options: options.slice(0, 3),
      provider: llmRes.provider,
    }, { status: 200 });

  } catch (error: any) {
    console.error("Drafting reply failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
