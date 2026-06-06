import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  const { data: users } = await db.from("users").select("id").limit(1);
  const userId = users?.[0]?.id;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: customStyles, error } = await db
    .from("custom_styles")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, customStyles }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  const { data: users } = await db.from("users").select("id, plan").limit(1);
  const user = users?.[0];

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Gate feature by plan (Starter is fine, but custom builder is Pro+ or Starter depending on plan configuration)
  // Section 6: Free plan has personal + 3 expert. Starter has all expert + custom builder. Pro has all + blending.
  // So Starter can access custom builder! Pro+ can also use blending.
  if (user.plan === "free") {
    return NextResponse.json({ error: "Custom styles require a Starter or Pro plan subscription." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, mode, sliders, pastedContent } = body;

    if (!name) {
      return NextResponse.json({ error: "Style name is required" }, { status: 400 });
    }

    let styleJson: any = {};
    let samplePost = "";

    if (mode === "sliders" && sliders) {
      // Map sliders to style JSON format
      styleJson = {
        avg_post_length_words: sliders.length === "short" ? 80 : sliders.length === "medium" ? 140 : 220,
        tone_descriptor: sliders.tone || "informative, direct",
        uses_emojis: sliders.emoji !== "none",
        emoji_frequency: sliders.emoji || "none",
        uses_line_breaks_for_drama: sliders.lineBreaks === "high",
        sentence_length_pattern: sliders.sentenceStyle || "varied",
        opener_patterns: sliders.opener ? [sliders.opener] : [],
        cta_style: sliders.closer || "none",
        storytelling_ratio: sliders.tone === "storytelling" ? 0.7 : 0.3,
        hashtag_style: "none"
      };
      samplePost = `Building is hard. Sliders configuration is complete. Tone: ${styleJson.tone_descriptor}. Spacing: ${styleJson.uses_line_breaks_for_drama ? "Double space" : "Single space"}.`;
    } else if (mode === "paste" && pastedContent) {
      // Analyze pasted content with LLM to extract style profile
      const analysisPrompt = `You are a style analysis intelligence engine. Analyze these sample posts and extract their writing style as a precise JSON profile.
SAMPLE POSTS:
"${pastedContent}"

Return ONLY a valid JSON object matching this schema. Do not add markdown backticks.
{
  "avg_post_length_words": 150,
  "sentence_length_pattern": "short, punchy, conversational",
  "opener_patterns": ["List 2 common openings seen in the samples"],
  "frequently_used_phrases": ["List 2 phrases used often"],
  "avoided_corporate_words": ["leverage", "delve"],
  "tone_descriptor": "authoritative, educational",
  "uses_emojis": true,
  "emoji_frequency": "low",
  "uses_line_breaks_for_drama": true,
  "cta_style": "minimal, question",
  "hashtag_style": "none",
  "storytelling_ratio": 0.4,
  "signature_structure": "structure description",
  "vocabulary_complexity": "simple",
  "unique_quirks": ["list 2 quirks"],
  "industry_vocabulary": ["list 2 key words"]
}`;

      const llmRes = await routeLLMRequest({
        useCase: "style_analysis",
        messages: [{ role: "user", content: analysisPrompt }],
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "custom-style-paste-" + Date.now(),
        responseFormat: "json"
      });

      try {
        styleJson = JSON.parse(llmRes.content);
      } catch (e) {
        const match = llmRes.content.match(/\{[\s\S]*\}/);
        if (match) {
          styleJson = JSON.parse(match[0]);
        } else {
          throw new Error("Failed to parse extracted style: " + llmRes.content);
        }
      }
      samplePost = pastedContent.substring(0, 200) + "...";
    } else {
      return NextResponse.json({ error: "Invalid parameters or content missing" }, { status: 400 });
    }

    const { data: newStyle, error } = await db
      .from("custom_styles")
      .insert({
        user_id: user.id,
        name,
        source_type: mode,
        style_json: styleJson,
        sample_post: samplePost,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, customStyle: newStyle }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
