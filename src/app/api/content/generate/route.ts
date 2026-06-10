import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { runAntigravityAgent } from "@/lib/agents/antigravity";
import { getAuthenticatedUserId } from "@/lib/auth";
import { cleanJsonString } from "@/lib/utils";
import { sendApprovalEmailInternal } from "@/lib/email";



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
6. Do NOT copy spoken transcripts verbatim or just fix grammar. Perform a deep thought leadership rewrite: structure the post with a strong hook, clear context/problem, a core actionable insight, and a conversational CTA.
7. Return ONLY a valid raw JSON object matching the requested schema. No Markdown blocks, no backticks, no text before or after the JSON.
8. NEVER use asterisks (*) or double asterisks (**) anywhere in the post content (e.g., for bolding, emphasis, titles, headers, or bullet points). Since LinkedIn does not support Markdown, it displays them as raw asterisks which is highly unprofessional. If you need bullet points, use unicode bullet characters like '•' or '-' instead. If you want to emphasize a header or a key phrase, use CAPITAL LETTERS instead of bold markdown tags.`;
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { transcript, style_type, style_id, blend_config, backend, web_search } = body;

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
        avg_post_length_words: 300,
        tone_descriptor: "authoritative, urgent, professional",
        uses_emojis: false,
        emoji_frequency: "none",
        uses_line_breaks_for_drama: true,
        sentence_length_pattern: "provocative hook, structured cluster",
        opener_patterns: ["Bold provocative statement", "Uncomfortable truth"],
        avoided_corporate_words: ["In today's world", "Let's dive in", "delve", "leverage"],
        cta_style: "one question to drive engagement",
        hashtag_style: "none",
        storytelling_ratio: 0.3,
      };
    }

    // Fetch recent topics to avoid repetition
    const { data: recentPosts } = await db
      .from("posts")
      .select("post_content")
      .eq("user_id", user.id)
      .limit(5);
    const recentTopics = recentPosts?.map((p: any) => p.post_content?.substring(0, 30)).filter(Boolean) || [];

    // --- Web Search Grounding ---
    let webSearchContext = "";
    if (web_search && (process.env.TAVILY_API_KEY || (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX))) {
      try {
        const queryRes = await routeLLMRequest({
          useCase: "keyword_extraction",
          messages: [
            {
              role: "system",
              content: "You are an assistant that extracts the single most effective web search query from a user's raw thoughts/transcript to find the latest news, facts, and details on the topic. Return ONLY the plain text search query. DO NOT include any introductory or concluding text, explanation, quotes, or markdown backticks.",
            },
            {
              role: "user",
              content: transcript,
            },
          ],
          userId: user.id,
          userPlan: user.plan || "pro",
          sessionId: "search-query-extraction-" + Date.now(),
        });
        let searchQuery = queryRes.content.trim();
        // Extract quoted text if present, otherwise clean general quotes/markdown
        searchQuery = searchQuery.replace(/^["'`]|["'`]$/g, "").trim();
        searchQuery = searchQuery.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "").trim();
        searchQuery = searchQuery.replace(/^(search query|query|search):\s*/i, "").trim();
        console.log(`[web-search] Extracted query: "${searchQuery}"`);

        if (process.env.TAVILY_API_KEY) {
          const tavilyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: searchQuery,
              search_depth: "basic",
              max_results: 3,
            }),
          });
          if (tavilyRes.ok) {
            const searchData = await tavilyRes.json();
            const results = searchData.results || [];
            webSearchContext = results
              .map((r: any) => `Source: ${r.title} (${r.url})\nContent: ${r.content}`)
              .join("\n\n");
          } else {
            console.error("[web-search] Tavily API error:", tavilyRes.statusText);
          }
        } else if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX) {
          const googleRes = await fetch(
            `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&q=${encodeURIComponent(searchQuery)}`
          );
          if (googleRes.ok) {
            const searchData = await googleRes.json();
            const items = searchData.items || [];
            webSearchContext = items
              .map((r: any) => `Source: ${r.title} (${r.link})\nContent: ${r.snippet}`)
              .join("\n\n");
          } else {
            console.error("[web-search] Google Custom Search API error:", googleRes.statusText);
          }
        }
      } catch (err) {
        console.error("[web-search] Failed to perform web search:", err);
      }
    }

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
          web_search_context: webSearchContext || undefined,
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
      let systemPrompt = buildSystemPrompt();
      let userPrompt = "";

      if (style_id === "fomo_style") {
        systemPrompt = `You are a LinkedIn content strategist and formatting expert. Take the article I provide and reformat it into a high-engagement LinkedIn post using FOMO-driven writing and LinkedIn's native rendering constraints.

FOMO WRITING RULES:
- Open with what most people are doing wrong or missing out on
- Make the reader feel the cost of not knowing this — in time, money, or opportunity
- Use contrast: what others do vs. what smart people do
- Imply scarcity of knowledge: "most people never figure this out"
- Frame each insight as something the reader is currently leaving on the table
- Use specific numbers and dollar amounts wherever possible — vague claims kill FOMO
- Build cumulative tension toward the payoff (the list, the revelation, the total cost)

FORMAT RULES:
- Short paragraphs: 1-2 sentences max, then a line break
- Section headers: ALL CAPS only (no markdown headers)
- Section dividers: use — — — between major sections
- Numbered lists: plain numbers only (1. 2. 3.)
- Sub-bullets: fold into short sentences, never use asterisks or dashes as bullets
- Tables: convert to plain-text stacked lists with em dashes
- Spacing: always one blank line between numbered items
- NEVER use asterisks (*) or double asterisks (**) anywhere in the post. Do NOT use them for bolding, emphasis, titles, headers, or bullet lists. Keep the text strictly plain text without any markdown or asterisk symbols. Use CAPITAL LETTERS for emphasis or headers, and standard unicode bullets like '•' or '-' if list bullets are needed.

HOOK RULES:
- First 2-3 lines must create immediate FOMO before the "...see more" cutoff (~210 characters)
- Lead with a cost, a mistake, or a gap most people don't know they have
- Make skipping past this feel like leaving money on the table
- Never start with "I" (LinkedIn algo penalizes it)

TONE RULES:
- No emoji
- No corporate filler ("I'm excited to share...")
- No preamble or throat-clearing
- Confident, direct, slightly provocative
- Write like someone who knows something most people don't — and is choosing to share it

CLOSING RULES:
- End with one specific engagement question on its own line
- One blank line above it
- The question should trigger self-reflection or mild defensiveness ("have you been doing this wrong?")
- Never "thoughts?" — make it sharp and specific to the content

Return your response ONLY in this JSON format (hashtags must be 6-8 lowercase strings without the # symbol, highly relevant to the post topic):
{
  "post_content": "The generated post text...",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6"],
  "hook_type": "FOMO",
  "post_structure": "FOMO style structure",
  "style_match_score": 10,
  "style_deviations": []
}`;

        userPrompt = `ARTICLE/CONTENT TO CONVERT:
"${transcript}"

${webSearchContext ? `ADDITIONAL LATEST WEB SEARCH CONTEXT (Use this to include the most up-to-date and accurate facts):
${webSearchContext}
` : ""}
TOPIC CONTEXT (optional but improves output):
- Industry: ${user.industry || "SaaS & Tech"}
- Target audience: ${user.job_title || "Founders / Managers / Freelancers"}
- Core message you want readers to take away: ${transcript.split(".")[0] || "One actionable insight."}`;
      } else {
        userPrompt = `TRANSCRIPT TO REWRITE:
"${transcript}"

${webSearchContext ? `ADDITIONAL LATEST WEB SEARCH CONTEXT (Use this to include the most up-to-date and accurate facts):
${webSearchContext}
` : ""}
STYLE PROFILE TARGET:
${JSON.stringify(selectedStyleJson, null, 2)}

USER CONTEXT:
Industry: ${user.industry}
Title: ${user.job_title}

RECENT POST TOPICS (Avoid repeating these concepts/hooks):
${recentTopics.join("\n")}

Rewrite instructions:
- Turn the chaotic raw transcript into an elite, professional thought-leadership LinkedIn post.
- Synthesize raw spoken thoughts. DO NOT copy phrases or filler speech verbatim. Write it with high density of value, clean layout, and professional clarity.
- Structure: Start with a scroll-stopping hook, flow into the core problem or situation, deliver a clear value-add/insight, provide a concrete actionable tip, and end with an engaging CTA/question matching the target style.
- NEVER use asterisks (*) or double asterisks (**) anywhere in the generated post content. Use unicode bullets (• or -) if bullets are needed, and CAPITAL LETTERS or line spacing for emphasis/headers.

Return your response ONLY in this JSON format (hashtags must be 6-8 lowercase strings without the # symbol, highly relevant to the post topic):
{
  "post_content": "The generated post text...",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6"],
  "hook_type": "The category of hook used (e.g. contrast, question, numbers)",
  "post_structure": "Brief description of structure used",
  "style_match_score": 9,
  "style_deviations": ["Any style traits that couldn't be fully satisfied"]
}`;
      }

      const waterfallRes = await routeLLMRequest({
        useCase: "content_generation",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "post-generation-" + Date.now(),
        responseFormat: "json",
        enableSearch: web_search,
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

    if (resultJson.post_content) {
      let cleanedPostContent = resultJson.post_content;
      // Remove markdown bold asterisks
      cleanedPostContent = cleanedPostContent.replace(/\*\*/g, "");
      // Replace bullet points starting with asterisks while preserving indentation
      cleanedPostContent = cleanedPostContent.replace(/^([ \t]*)\*[ \t]+/gm, "$1• ");
      // Strip any other random single asterisks
      cleanedPostContent = cleanedPostContent.replace(/\*/g, "");
      resultJson.post_content = cleanedPostContent;
    }

    resultJson.review_suggested = false;

    // Clean and validate hashtags
    let finalHashtags: string[] = (resultJson.hashtags || [])
      .map((h: string) => h.replace(/^#/, "").toLowerCase().trim())
      .filter(Boolean);

    if (finalHashtags.length < 6) {
      const industry = (user.industry || "professional").toLowerCase();
      let fallbacks = ["growth", "productivity", "networking", "leadership", "innovation", "business"];
      if (industry.includes("saas") || industry.includes("tech") || industry.includes("ai")) {
        fallbacks = ["saas", "startup", "tech", "ai", "software", "founders"];
      } else if (industry.includes("marketing") || industry.includes("brand")) {
        fallbacks = ["marketing", "branding", "business", "digitalmarketing", "contentmarketing", "growth"];
      } else if (industry.includes("finance") || industry.includes("invest")) {
        fallbacks = ["finance", "investing", "wealthmanagement", "fintech", "business", "money"];
      }
      finalHashtags = Array.from(new Set([...finalHashtags, ...fallbacks])).slice(0, 8);
    }

    resultJson.hashtags = finalHashtags;

    // 4. Save post to Database as pending_approval
    let matchScore = parseInt(resultJson.style_match_score, 10);
    if (isNaN(matchScore)) {
      matchScore = 8;
    } else if (matchScore >= 10 && matchScore <= 100) {
      matchScore = Math.round(matchScore / 10);
    }
    matchScore = Math.max(1, Math.min(10, matchScore));

    const postPayload: any = {
      user_id: user.id,
      transcript_corrected: transcript,
      post_content: resultJson.post_content,
      hashtags: finalHashtags,
      style_type,
      style_id,
      blend_config: blend_config || null,
      style_match_score: matchScore,
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

    // 6. Fire draft email notification — send synchronously BEFORE returning response.
    //    setImmediate is killed by Vercel after the HTTP response is sent.
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      await sendApprovalEmailInternal({
        post_id: newPost.id,
        post_content: newPost.post_content,
        hashtags: newPost.hashtags || [],
        baseUrl,
      });
    } catch (emailErr) {
      // Email failure should never block the post response
      console.warn("[generate] Email notification failed (non-blocking):", emailErr);
    }

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
        review_suggested: resultJson.review_suggested,
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
