import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { buildSystemPrompt } from "@/app/api/content/generate/route";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    let userId = await getAuthenticatedUserId(req);
    if (!userId) {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        userId = body.userId;
      } catch {}
    }

    let user: any = null;
    if (userId) {
      const { data } = await db.from("users").select("id, plan, industry, keywords").eq("id", userId).single();
      user = data;
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 1. Fetch raw posts
    const { data: rawPosts } = await db
      .from("user_posts_raw")
      .select("content")
      .eq("user_id", user.id)
      .limit(10); // Analyze up to 10 posts for performance/cost

    if (!rawPosts || rawPosts.length < 3) {
      // Set low_data flag in account if we have low data
      await db.from("linkedin_accounts")
        .update({ low_data: true, scraping_status: "complete" })
        .eq("user_id", user.id);

      // Return a default style profile so user can still proceed
      const defaultStyle = {
        avg_post_length_words: 120,
        sentence_length_pattern: "varied, short",
        opener_patterns: ["What I've noticed about...", "Honestly,"],
        frequently_used_phrases: ["Action beats planning"],
        avoided_corporate_words: ["leverage", "delve"],
        tone_descriptor: "pragmatic, educational",
        uses_emojis: true,
        emoji_frequency: "low",
        uses_line_breaks_for_drama: true,
        cta_style: "question at the end",
        hashtag_count_avg: 0,
        hashtag_style: "none",
        storytelling_ratio: 0.3,
        signature_structure: "concise lists",
        vocabulary_complexity: "simple",
        unique_quirks: ["short line breaks"],
        industry_vocabulary: [user.industry || "Tech"]
      };

      const samplePost = "Honestly, building in public is hard. Speed is everything. What I've noticed is that shipping beats overthinking every single time. What are you launching today?";

      const { data: profile } = await db.from("style_profiles").upsert({
        user_id: user.id,
        style_json: defaultStyle,
        posts_analyzed_count: rawPosts?.length || 0,
        last_analyzed_at: new Date().toISOString(),
        user_confirmed: false,
        sample_post: samplePost,
      }, { onConflict: "user_id" }).select().single();

      return NextResponse.json({
        success: true,
        low_data: true,
        profile,
        message: "Not enough posts found (< 3). Generated a default style profile."
      });
    }

    // 2. Compile posts content
    const compiledPosts = rawPosts.map((p, idx) => `POST #${idx + 1}:\n${p.content}`).join("\n\n");

    const analysisPrompt = `You are a style analysis intelligence engine. Analyze these authentic LinkedIn posts written by the user and extract their writing DNA.
USER POSTS TO ANALYZE:
${compiledPosts}

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
  "hashtag_count_avg": 2,
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
      sessionId: "style-analysis-" + Date.now(),
      responseFormat: "json",
    });

    let styleJson: any = {};
    try {
      styleJson = JSON.parse(llmRes.content);
    } catch (e) {
      const match = llmRes.content.match(/\{[\s\S]*\}/);
      if (match) {
        styleJson = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse analysis results: " + llmRes.content);
      }
    }

    // 3. Generate confirmation sample post
    const samplePrompt = `Write a confirmation sample LinkedIn post (50-120 words) representing this extracted style DNA:
STYLE:
${JSON.stringify(styleJson, null, 2)}

Topic: "Why consistency beats talent in the long run"
Return ONLY the text of the sample post. No comments.`;

    const sampleRes = await routeLLMRequest({
      useCase: "style_preview",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: samplePrompt }
      ],
      userId: user.id,
      userPlan: user.plan as any,
      sessionId: "style-sample-" + Date.now(),
    });

    const samplePost = sampleRes.content.trim().replace(/^"|"$/g, "");

    // 4. Save to style_profiles
    const { data: profile, error: saveErr } = await db.from("style_profiles").upsert({
      user_id: user.id,
      style_json: styleJson,
      posts_analyzed_count: rawPosts.length,
      last_analyzed_at: new Date().toISOString(),
      user_confirmed: false,
      sample_post: samplePost,
    }, { onConflict: "user_id" }).select().single();

    if (saveErr) throw saveErr;

    return NextResponse.json({
      success: true,
      low_data: false,
      profile,
    });

  } catch (error: any) {
    console.error("Style analysis failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
