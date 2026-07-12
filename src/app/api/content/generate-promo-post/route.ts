import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { cleanJsonString } from "@/lib/utils";
import { BANNED_WORDS } from "@/app/api/content/generate/route";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { parent_post_id, style_type, style_id, blend_config } = body;

    if (!parent_post_id) {
      return NextResponse.json({ error: "parent_post_id is required" }, { status: 400 });
    }

    // Get active user
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: user } = await db
      .from("users")
      .select("id, email, plan, industry, job_title")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch parent article details
    const { data: parentPost, error: parentErr } = await db
      .from("posts")
      .select("*")
      .eq("id", parent_post_id)
      .eq("user_id", userId)
      .single();

    if (parentErr || !parentPost) {
      return NextResponse.json({ error: "Parent article not found or unauthorized" }, { status: 404 });
    }

    // 1. Fetch style JSON
    let selectedStyleJson: any = {};
    if (style_type === "expert") {
      const { data: exp } = await db.from("expert_styles").select("style_json").eq("id", style_id).single();
      selectedStyleJson = exp?.style_json || {};
    } else if (style_type === "custom") {
      const { data: cust } = await db.from("custom_styles").select("style_json").eq("id", style_id).single();
      selectedStyleJson = cust?.style_json || {};
    } else if (style_type === "own") {
      const { data: own } = await db.from("style_profiles").select("style_json").eq("user_id", user.id).single();
      selectedStyleJson = own?.style_json || {};
    } else if (style_type === "blend") {
      const { primary_id, secondary_id, ratio } = blend_config || { ratio: 0.5 };
      const { data: s1 } = await db.from("expert_styles").select("style_json").eq("id", primary_id).single();
      const { data: s2 } = await db.from("expert_styles").select("style_json").eq("id", secondary_id).single();
      const json1 = s1?.style_json || {};
      const json2 = s2?.style_json || {};

      selectedStyleJson = {
        avg_post_length_words: Math.round((json1.avg_post_length_words || 150) * ratio + (json2.avg_post_length_words || 150) * (1 - ratio)),
        tone_descriptor: `${json1.tone_descriptor || ""}, ${json2.tone_descriptor || ""}`,
        uses_emojis: json1.uses_emojis || json2.uses_emojis,
        emoji_frequency: ratio > 0.5 ? json1.emoji_frequency : json2.emoji_frequency,
        uses_line_breaks_for_drama: json1.uses_line_breaks_for_drama || json2.uses_line_breaks_for_drama,
        sentence_length_pattern: ratio > 0.5 ? json1.sentence_length_pattern : json2.sentence_length_pattern,
        opener_patterns: Array.from(new Set([...(json1.opener_patterns || []), ...(json2.opener_patterns || [])])),
        avoided_corporate_words: Array.from(new Set([...(json1.avoided_corporate_words || []), ...(json2.avoided_corporate_words || [])])),
        cta_style: ratio > 0.5 ? json1.cta_style : json2.cta_style,
        hashtag_style: ratio > 0.5 ? json1.hashtag_style : json2.hashtag_style,
      };
    }

    if (!selectedStyleJson.avg_post_length_words) {
      selectedStyleJson = {
        avg_post_length_words: 150,
        tone_descriptor: "professional, engaging",
        uses_emojis: true,
        emoji_frequency: "medium",
        uses_line_breaks_for_drama: true,
        sentence_length_pattern: "varied",
        opener_patterns: ["Here is a quick concept..."],
        avoided_corporate_words: BANNED_WORDS,
        cta_style: "question",
        hashtag_style: "relevant",
      };
    }

    // Build prompt for promo post
    const systemPrompt = `You are a LinkedIn content strategist, copywriting master, and formatting expert. Your task is to write a high-engagement, detailed LinkedIn feed post that PROMOTES the long-form article provided.
    
    PROMO POST RULES:
    1. FOMO Structure & Hook:
       - Open with what most people or organizations are doing wrong, or a major opportunity they are missing out on.
       - Create instant tension: make the reader feel the cost of not knowing this (in lost hours, revenue, or career growth).
       - Frame the teaser points not just as general summaries, but as "blindspots" the reader needs to fix.
    2. Value Teaser (FOMO Style):
       - Extract the 3 most crucial insights, frameworks, or metrics from the article.
       - Detail them in a highly scannable, multi-line format using unicode bullet points (like '•' or '-').
       - Keep each point substantive (1-2 sentences with concrete numbers/concepts) but build curiosity: explain *what* the problem/insight is, but leave the *how-to execution details* for the full article.
    3. Call to Action (CTA):
       - End with a compelling question or reflective thought, immediately followed by the exact placeholder: "👉 Read the full breakdown and strategy here: {article_url}" (keep this EXACT string as a placeholder; do not replace it with a real URL yet).
    4. Vary sentence length: Mix short, punchy statements with medium explanatory sentences.
    5. Formatting:
       - Keep paragraphs to 1-2 sentences max, with double line breaks for mobile readability.
       - NEVER use asterisks (*) or double asterisks (**) anywhere in the post content (no bold markdown). Use CAPITAL LETTERS for headers/emphasis.
       - Do not use corporate fluff ("I'm excited to share", "delve").
    6. Banned Phrases: Avoid ${BANNED_WORDS.join(", ")}.

    Return your response ONLY in this JSON format:
    {
      "post_content": "The promotional post text containing the {article_url} placeholder...",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6"],
      "hook_type": "FOMO Teaser",
      "post_structure": "FOMO promotional teaser",
      "style_match_score": 10,
      "style_deviations": []
    }`;

    const userPrompt = `ARTICLE TO PROMOTE:
"${parentPost.post_content}"

STYLE PROFILE TARGET:
${JSON.stringify(selectedStyleJson, null, 2)}

USER CONTEXT:
Industry: ${user.industry}
Title: ${user.job_title}

Rewrite instructions:
- Turn this article into a high-impact, standalone-value feed post that uses FOMO copywriting principles to drive clicks to the article.
- Focus heavily on detailing the stakes and the main 3 concepts, maintaining high quality and professional density of value throughout the post content.`;

    const llmRes = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId: user.id,
      userPlan: user.plan as any,
      sessionId: `promo-post-generation-` + Date.now(),
      responseFormat: "json",
    });

    let resultJson: any = {};
    try {
      resultJson = JSON.parse(cleanJsonString(llmRes.content));
    } catch (e) {
      // Fallback parser matching regex
      const match = llmRes.content.match(/\{[\s\S]*\}/);
      if (match) {
        resultJson = JSON.parse(cleanJsonString(match[0]));
      } else {
        throw new Error("Failed to parse AI response: " + llmRes.content);
      }
    }

    if (!resultJson.post_content) {
      throw new Error("AI response did not contain post_content");
    }

    // Clean post content (remove raw markdown asterisks)
    let cleanedPostContent = resultJson.post_content;
    cleanedPostContent = cleanedPostContent.replace(/\*\*/g, "");
    cleanedPostContent = cleanedPostContent.replace(/^([ \t]*)\*[ \t]+/gm, "$1• ");
    cleanedPostContent = cleanedPostContent.replace(/\*/g, "");
    resultJson.post_content = cleanedPostContent;

    // Clean hashtags
    const finalHashtags: string[] = (resultJson.hashtags || [])
      .map((h: string) => h.replace(/^#/, "").toLowerCase().trim())
      .filter(Boolean);

    // Save promotional post to Database
    const postPayload = {
      user_id: user.id,
      parent_post_id: parent_post_id,
      post_content: resultJson.post_content,
      hashtags: finalHashtags,
      style_type,
      style_id,
      blend_config: blend_config || null,
      status: "pending_approval",
      current_revision: 1,
      content_type: "post",
    };

    let newPost: any = null;
    let postErr: any = null;

    try {
      const { data, error } = await db.from("posts").insert(postPayload).select().single();
      newPost = data;
      postErr = error;
    } catch (err) {
      // Schema cache fallback (retry deleting parent_post_id if migration has not cached in schema yet)
      const fallbackPayload = { ...postPayload };
      delete fallbackPayload.parent_post_id;
      const { data, error } = await db.from("posts").insert(fallbackPayload).select().single();
      newPost = data;
      postErr = error;
    }

    if (postErr || !newPost) {
      return NextResponse.json({ error: "Failed to insert promotional post: " + (postErr?.message || "Unknown error") }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      post_id: newPost.id,
      post_content: newPost.post_content,
      hashtags: newPost.hashtags,
    });

  } catch (err: any) {
    console.error("Promotional post generation failed:", err);
    return NextResponse.json({ error: err.message || "Failed to generate promotional post" }, { status: 500 });
  }
}
