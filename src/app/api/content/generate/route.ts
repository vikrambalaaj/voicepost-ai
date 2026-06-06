import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { runAntigravityAgent } from "@/lib/agents/antigravity";
import { getAuthenticatedUserId } from "@/lib/auth";
import { cleanJsonString } from "@/lib/utils";

// Banned words list
export const BANNED_WORDS = [
  "delve", "leverage", "game-changer", "transformative", "paradigm shift",
  "it's important to note", "in today's fast-paced world", "I'm thrilled to share",
  "unlock", "rockstar", "ninja", "guru", "synergy", "cutting-edge",
  "disruptive", "ecosystem", "seamlessly", "empower", "spearhead",
  "thought leader", "move the needle"
];

export function buildSystemPrompt(): string {
  return `You are a professional ghostwriter for high-impact LinkedIn content. Your writing MUST pass AI detection tools as human-written.

CRITICAL RULES:
1. NEVER use any of these banned AI words/phrases: ${BANNED_WORDS.join(", ")}.
2. Vary sentence length: Mix short (5-8 words) sentences with medium-long (15-20 words) sentences.
3. Use contractions naturally (e.g., I've, it's, we're, don't, can't).
4. Include exactly ONE personal marker (choose only one, never more): 'In my experience' OR 'Honestly,' OR 'What I've noticed'.
5. Strictly conform to the style JSON properties (length, tone, emojis, spacing, CTA).
6. Return ONLY a valid raw JSON object matching the requested schema. No Markdown blocks, no backticks, no text before or after the JSON.`;
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { transcript, style_type, style_id, blend_config, backend } = body;

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    // Get active user
    const userId = await getAuthenticatedUserId(req);
    let user: any = null;
    if (userId) {
      const { data } = await db
        .from("users")
        .select("id, email, full_name, industry, job_title, plan")
        .eq("id", userId)
        .single();
      user = data;
    }

    if (!user) {
      user = {
        id: "00000000-0000-0000-0000-000000000000",
        email: "demo@voicepost.com",
        full_name: "Demo User",
        industry: "SaaS & Tech",
        job_title: "Tech Founder",
        plan: "pro",
      };
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
      // Blend styles
      const { primary_id, secondary_id, ratio } = blend_config || { ratio: 0.5 };
      
      const { data: s1 } = await db.from("expert_styles").select("style_json").eq("id", primary_id).single();
      const { data: s2 } = await db.from("expert_styles").select("style_json").eq("id", secondary_id).single();
      
      const json1 = s1?.style_json || {};
      const json2 = s2?.style_json || {};

      // Blend numbers and union arrays
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
        storytelling_ratio: (json1.storytelling_ratio || 0.4) * ratio + (json2.storytelling_ratio || 0.4) * (1 - ratio),
      };
    }

    // Default values if selectedStyleJson is empty
    if (!selectedStyleJson.avg_post_length_words) {
      selectedStyleJson = {
        avg_post_length_words: 130,
        tone_descriptor: "professional, helpful, concise",
        uses_emojis: true,
        emoji_frequency: "low",
        uses_line_breaks_for_drama: true,
        sentence_length_pattern: "varied, short",
        opener_patterns: ["I noticed something about..."],
        avoided_corporate_words: BANNED_WORDS,
        cta_style: "question at the end",
        hashtag_style: "none",
        storytelling_ratio: 0.4,
      };
    }

    // Fetch recent topics to avoid repetition
    const { data: recentPosts } = await db
      .from("posts")
      .select("post_content")
      .eq("user_id", user.id)
      .limit(5);
    const recentTopics = recentPosts?.map(p => p.post_content?.substring(0, 30)).filter(Boolean) || [];

    let resultJson: any = {};
    let llmRes: any = null;
    let agentThoughts = "";

    if (backend === "antigravity") {
      try {
        const agentResponse = await runAntigravityAgent({
          action: "generate",
          transcript,
          style_json: selectedStyleJson,
          user_context: {
            industry: user.industry || "SaaS & Tech",
            job_title: user.job_title || "Tech Founder",
          },
          recent_topics: recentTopics,
        });

        if (agentResponse.success && agentResponse.result) {
          resultJson = agentResponse.result;
          agentThoughts = agentResponse.thoughts || "";
          llmRes = {
            provider: "Advanced AI Agent",
            model: "gemini-3.5-flash",
            latencyMs: 1500,
          };
        } else {
          console.warn("Antigravity Agent failed or returned invalid response. Falling back to LLM Waterfall. Error:", agentResponse.error);
        }
      } catch (err) {
        console.error("Antigravity Agent execution exception. Falling back to LLM Waterfall. Error:", err);
      }
    }

    // Fallback if not generated by agent
    if (!llmRes || !resultJson.post_content) {
      // 2. Build AI Request
      const userPrompt = `TRANSCRIPT TO REWRITE:
"${transcript}"

STYLE PROFILE TARGET:
${JSON.stringify(selectedStyleJson, null, 2)}

USER CONTEXT:
Industry: ${user.industry}
Title: ${user.job_title}

RECENT POST TOPICS (Avoid repeating these concepts/hooks):
${recentTopics.join("\n")}

Please generate a professional LinkedIn post rewritten from the transcript matching the target style.
Return your response ONLY in this JSON format:
{
  "post_content": "The generated post text...",
  "hashtags": ["hashtag1", "hashtag2"],
  "hook_type": "The category of hook used (e.g. contrast, question, numbers)",
  "post_structure": "Brief description of structure used",
  "style_match_score": 9,
  "style_deviations": ["Any style traits that couldn't be fully satisfied"]
}`;

      const waterfallRes = await routeLLMRequest({
        useCase: "content_generation",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userPrompt }
        ],
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "post-generation-" + Date.now(),
        responseFormat: "json",
      });

      llmRes = waterfallRes;

      try {
        resultJson = JSON.parse(cleanJsonString(llmRes.content));
      } catch (e) {
        // If parsing fails, attempt regex extraction
        const match = llmRes.content.match(/\{[\s\S]*\}/);
        if (match) {
          resultJson = JSON.parse(cleanJsonString(match[0]));
        } else {
          throw new Error("Failed to parse AI JSON response: " + llmRes.content);
        }
      }
    }

    // 3. Second Pass: Human Authenticity Check
    // Send post_content to fastest provider (Groq 8B) to polish it
    let polishedPostContent = resultJson.post_content;
    let reviewSuggested = false;
    
    try {
      const polishPrompt = `You are a human copywriter. Review this draft. Find and rewrite any phrases that sound artificial, clunky, or obviously AI-generated.
Ensure there are no corporate buzzwords like delve, leverage, thought leader.
Return ONLY the polished post content text. No comments, no formatting boxes.

DRAFT:
"${resultJson.post_content}"`;

      const polishStartTime = Date.now();
      const polishRes = await routeLLMRequest({
        useCase: "transcript_correction",
        messages: [{ role: "user", content: polishPrompt }],
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "post-humanizer-" + Date.now(),
        preferredProviderId: "groq", // Fast path
      });
      
      const polishLatency = Date.now() - polishStartTime;
      if (polishLatency <= 3000) {
        polishedPostContent = polishRes.content.trim();
      } else {
        reviewSuggested = true; // flag review suggested badge if latency > 3s
      }
    } catch (err) {
      reviewSuggested = true;
    }

    resultJson.post_content = polishedPostContent;
    resultJson.review_suggested = reviewSuggested;

    // 3b. Hashtag Enrichment Pass — ensure at least 3 relevant hashtags
    let finalHashtags: string[] = (resultJson.hashtags || []).map((h: string) => h.replace(/^#/, "").toLowerCase().trim()).filter(Boolean);

    if (finalHashtags.length < 3) {
      try {
        const hashtagPrompt = `Generate exactly 5 professional LinkedIn hashtags for this post. Return ONLY a valid JSON array of lowercase strings without the # symbol. Example: ["ai","saas","startup","productivity","tech"]. No explanation, no extra text.

POST:
"${resultJson.post_content}"

INDUSTRY: ${user.industry}`;

        const hashtagRes = await routeLLMRequest({
          useCase: "transcript_correction",
          messages: [
            { role: "system", content: "Output ONLY a valid JSON array of 5 lowercase hashtag strings. No markdown, no explanation." },
            { role: "user", content: hashtagPrompt },
          ],
          userId: user.id,
          userPlan: user.plan as any,
          sessionId: "hashtag-enrichment-" + Date.now(),
        });

        const rawHashtagContent = hashtagRes.content.trim();
        const jsonMatch = rawHashtagContent.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const parsed: string[] = JSON.parse(cleanJsonString(jsonMatch[0]));
          const enriched = parsed.map((h) => h.replace(/^#/, "").toLowerCase().trim()).filter(Boolean);
          // Merge existing + enriched, deduplicate, cap at 8
          const merged = Array.from(new Set([...finalHashtags, ...enriched])).slice(0, 8);
          finalHashtags = merged;
          console.log(`[generate] Hashtag enrichment: ${finalHashtags.join(", ")}`);
        }
      } catch (hashtagErr) {
        console.warn("[generate] Hashtag enrichment failed, using existing tags:", hashtagErr);
      }
    }

    resultJson.hashtags = finalHashtags;

    // 4. Save post to Database as pending_approval
    const postPayload: any = {
      user_id: user.id,
      transcript_corrected: transcript,
      post_content: resultJson.post_content,
      hashtags: finalHashtags,
      style_type,
      style_id,
      blend_config: blend_config || null,
      style_match_score: resultJson.style_match_score || 8,
      status: "pending_approval",
      current_revision: 1,
    };

    if (agentThoughts) {
      postPayload.agent_thoughts = agentThoughts;
    }

    let newPost: any = null;
    let postErr: any = null;

    try {
      const { data, error } = await db.from("posts").insert(postPayload).select().single();
      newPost = data;
      postErr = error;
    } catch (err) {
      // Fallback: Retry inserting without agent_thoughts column if schema is not updated
      delete postPayload.agent_thoughts;
      const { data, error } = await db.from("posts").insert(postPayload).select().single();
      newPost = data;
      postErr = error;
    }

    if (postErr) {
      throw postErr;
    }

    // Save initial revision
    await db.from("post_revisions").insert({
      post_id: newPost.id,
      revision_number: 1,
      post_content: newPost.post_content,
      hashtags: newPost.hashtags,
      provider_used: llmRes.provider,
      model_used: llmRes.model,
      style_match_score: newPost.style_match_score,
      latency_ms: llmRes.latencyMs,
    });

    // 6. Fire draft email notification — non-blocking
    try {
      const baseUrl = req.nextUrl.origin;
      fetch(`${baseUrl}/api/notify/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: newPost.id,
          post_content: newPost.post_content,
          hashtags: newPost.hashtags || [],
          approval_url: `${baseUrl}/posts/${newPost.id}/approval`,
        }),
      }).catch((err) => console.warn("[generate] Email notification failed (non-blocking):", err));
    } catch (_) {}

    return NextResponse.json({
      success: true,
      post_id: newPost.id,
      approval_package: {
        post_content: newPost.post_content,
        hashtags: newPost.hashtags,
        style_match_score: newPost.style_match_score,
        hook_type: resultJson.hook_type,
        post_structure: resultJson.post_structure,
        style_deviations: resultJson.style_deviations || [],
        review_suggested: reviewSuggested,
        provider: llmRes.provider,
        latencyMs: llmRes.latencyMs,
        agent_thoughts: agentThoughts || null,
      }
    });

  } catch (error: any) {
    console.error("Content generation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
