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

export function buildSystemPrompt(styleJson: any = {}): string {
  let professionalismInstruction = "";
  if (styleJson.dna_professionalism !== undefined) {
    if (styleJson.dna_professionalism > 75) {
      professionalismInstruction = "Write in an authoritative, highly professional, corporate enterprise tone.";
    } else if (styleJson.dna_professionalism < 35) {
      professionalismInstruction = "Write in a highly casual, friendly, conversational, and direct tone.";
    } else {
      professionalismInstruction = "Write in a balanced professional and conversational tone.";
    }
  }

  let emojiInstruction = "Do not use emojis unless instructed.";
  if (styleJson.dna_emoji_density !== undefined) {
    if (styleJson.dna_emoji_density > 75) {
      emojiInstruction = "Include emojis frequently to separate sections and highlight points (rich emoji usage).";
    } else if (styleJson.dna_emoji_density < 20) {
      emojiInstruction = "Strictly do NOT use any emojis in the post content under any circumstances.";
    } else {
      emojiInstruction = "Use emojis sparingly (maximum 2-3 throughout the entire post).";
    }
  }

  let assertivenessInstruction = "";
  if (styleJson.dna_assertiveness !== undefined) {
    if (styleJson.dna_assertiveness > 75) {
      assertivenessInstruction = "Be extremely bold, confident, and direct. Make strong, clear statements.";
    } else if (styleJson.dna_assertiveness < 35) {
      assertivenessInstruction = "Be diplomatic, inclusive, and advisory. Use consultative language.";
    }
  }

  let formattingInstruction = "";
  if (styleJson.dna_formatting_layout !== undefined) {
    if (styleJson.dna_formatting_layout === "paragraphs") {
      formattingInstruction = "Format the post using clean paragraphs separated by empty lines. Avoid bullet lists.";
    } else if (styleJson.dna_formatting_layout === "bullets") {
      formattingInstruction = "Use bullet points or numbered lists heavily to structure the body. Keep text paragraphs minimal.";
    } else {
      formattingInstruction = "Use a mix of short paragraphs and structured bullet points to ensure maximum readability.";
    }
  }

  return `You are a professional ghostwriter for high-impact LinkedIn content. Your writing MUST pass AI detection tools as human-written.

CRITICAL STYLE INSTRUCTIONS:
- ${professionalismInstruction}
- ${emojiInstruction}
- ${assertivenessInstruction}
- ${formattingInstruction}

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

export async function humanizePostContent(
  content: string,
  userId: string,
  userPlan: "free" | "starter" | "pro" | "agency",
  sessionId: string
): Promise<string> {
  try {
    const res = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        {
          role: "system",
          content: "You are a professional LinkedIn content humanizer. Your sole job is to rewrite the provided post content so it sounds completely natural, authentic, and human-written. Do NOT change the core message or structural layout, but make the phrasing and flow sound like a real person wrote it. Avoid all corporate jargon, AI buzzwords, and repetitive opening structures. Do not output any markdown formatting, asterisks (*), double asterisks (**), bold tags, notes, or explanations. Return ONLY the rewritten post content."
        },
        {
          role: "user",
          content: `Here is the post content to humanize:\n\n${content}`
        }
      ],
      userId,
      userPlan,
      sessionId: "humanizer-" + sessionId,
    });
    return res.content.trim();
  } catch (err) {
    console.error("Humanizer pass failed, returning original content:", err);
    return content;
  }
}

export async function humanizeCarouselSlides(
  slides: any[],
  userId: string,
  userPlan: "free" | "starter" | "pro" | "agency",
  sessionId: string,
  topic?: string
): Promise<any[]> {
  try {
    const topicContext = topic ? `The carousel topic is: "${topic}". All slide content must remain 100% about this topic after humanization. Do NOT introduce client names, case studies, or generic business jargon unrelated to this topic. Banned phrases: "Our client", "A client of ours", "Success Story", "A Client's Journey", "Real-World Example".` : "";
    const res = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        {
          role: "system",
          content: `You are a professional LinkedIn content humanizer. Your task is to rewrite the text content of the slides (title, body, subtitle, footer, points, and metrics arrays if present) to sound completely human-written, engaging, and natural. Avoid corporate jargon and AI words. Maintain the exact same JSON array structure, preserving properties like 'layout', 'badge', 'slideNumber', and 'type'. If a slide has a 'points' array, ensure it keeps exactly 3 points. If a slide has a 'metrics' array, ensure it keeps exactly 3 metrics (each with 'value', 'label', and 'text'). Preserve double asterisks (**) inside slide titles (used for word highlighting) under all circumstances. Return ONLY the valid JSON array of slides. ${topicContext}`
        },
        {
          role: "user",
          content: `Humanize the text inside this slides JSON array. Keep the slideNumber, type, layout, and badge exactly the same. Humanize the title, body, subtitle, footer, the title & text of each item in the points array, and the value, label & text of each item in the metrics array if present. Return only the JSON array:\n\n${JSON.stringify(slides, null, 2)}`
        }
      ],
      userId,
      userPlan,
      sessionId: "humanizer-carousel-" + sessionId,
      responseFormat: "json",
    });
    
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleanJsonString(res.content));
    } catch (e) {
      const match = res.content.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        parsed = JSON.parse(cleanJsonString(match[0]));
      } else {
        throw new Error("Failed to parse AI humanized JSON response: " + res.content);
      }
    }
    
    return Array.isArray(parsed) ? parsed : slides;
  } catch (err) {
    console.error("Humanizer carousel pass failed, returning original slides:", err);
    return slides;
  }
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { transcript, style_type, style_id, blend_config, backend, web_search, preserve_text, image_url, image_source_type, image_prompt, series_count, content_type } = body;
    const targetContentType = content_type || "post";

    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    // Get active user
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: user } = await db
      .from("users")
      .select("id, email, full_name, industry, job_title, plan")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
    const cleanTranscript = transcript.trim();
    const isShortInput = cleanTranscript.length < 80 || cleanTranscript.split(/\s+/).length < 12;
    const shouldSearch = !preserve_text && (web_search || isShortInput);

    if (shouldSearch && (process.env.TAVILY_API_KEY || (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX))) {
      if (isShortInput && !web_search) {
        console.log(`[web-search] Automatically triggering search grounding due to short/vague input: "${cleanTranscript}"`);
      }
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

    const seriesCount = series_count ? Math.max(1, Math.min(5, parseInt(series_count, 10))) : 1;
    const seriesId = crypto.randomUUID();
    const createdPosts: any[] = [];

    for (let index = 1; index <= seriesCount; index++) {
      let resultJson: any = {};
      let llmRes: any = null;
      let agentThoughts = "";

      const previousPostsText = createdPosts
        .map((p, idx) => `PART ${idx + 1}:\n${p.post_content}`)
        .join("\n\n");

      if (backend === "antigravity" && targetContentType !== "article") {
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
            preserve_text: preserve_text || undefined,
            series_context: seriesCount > 1 ? {
              index,
              count: seriesCount,
              previous_parts: createdPosts.map((p, i) => `PART ${i + 1}:\n${p.post_content}`),
            } : undefined,
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
        // Build AI Request
        let systemPrompt = buildSystemPrompt(selectedStyleJson);
        if (preserve_text) {
          systemPrompt += "\nCRITICAL: The user has selected 'PRESERVE ORIGINAL TEXT'. You MUST keep the text content, sentences, and core wording exactly as provided. Do not rewrite, summarize, or alter the core hook or body text. Focus ONLY on professional formatting, clean spacing, bullet points formatting (if any), and structuring it exactly as requested in the JSON schema without altering the words.";
        }
        let userPrompt = "";

        if (targetContentType === "article") {
          systemPrompt = `You are a professional LinkedIn newsletter and article strategist. Your job is to write a high-impact, long-form, thought-leadership LinkedIn Article based on the user's raw transcript/ideas.
          
          ARTICLE RULES:
          1. Length: Write a comprehensive, detailed article (approx. 500 to 1000 words).
          2. Structure:
             - Start with a compelling H1 headline title (e.g. # The Future of SaaS Engineering).
             - Use clear H2 and H3 markdown headers (e.g. ## The Problem, ### 1. Key Metrics) to section the article.
             - Write a strong, hooky introduction that sets the stage.
             - Dive deep into 3-4 structured body sections explaining the concepts, lessons, or framework details.
             - Use bullet points (standard unicode bullets like '•' or '-') and blockquotes where appropriate to break up text and make it highly readable.
             - Conclude with a strong, inspiring summary and a call-to-action (CTA) to subscribe/follow.
          3. Formatting:
             - You MUST use markdown formatting for headers (#, ##, ###) and bold text (**) for articles, since LinkedIn Articles support rich HTML/markdown styling.
             - Use standard spacing (blank lines between sections).
          4. NEVER use AI banned phrases: ${BANNED_WORDS.join(", ")}.
          
          Return your response ONLY in this JSON format:
          {
            "post_content": "The full article in markdown format starting with the H1 title...",
            "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5", "hashtag6"],
            "hook_type": "Article",
            "post_structure": "Long-form article structure",
            "style_match_score": 10,
            "style_deviations": []
          }`;
          if (preserve_text) {
            systemPrompt += "\nCRITICAL: The user has selected 'PRESERVE ORIGINAL TEXT'. You MUST keep the text content, sentences, and core wording exactly as provided. Do not rewrite, summarize, or alter the core hook or body text. Focus ONLY on professional formatting, clean spacing, bullet points formatting (if any), and structuring it exactly as requested in the JSON schema without altering the words.";
          }

          userPrompt = `TRANSCRIPT/IDEAS FOR ARTICLE:
"${transcript}"

${webSearchContext ? `ADDITIONAL LATEST WEB SEARCH CONTEXT (Use this to include the most up-to-date and accurate facts):
${webSearchContext}
` : ""}
STYLE PROFILE TARGET:
${JSON.stringify(selectedStyleJson, null, 2)}

USER CONTEXT:
Industry: ${user.industry}
Title: ${user.job_title}

Rewrite instructions:
${preserve_text ? `- PRESERVE ORIGINAL TEXT: Keep the text content, sentences, and wording exactly as provided. Focus ONLY on converting it into a clean, structured article format with headings and spacing.` : `- Expand the raw transcript into an elite, professional thought-leadership LinkedIn Article. Do not write a short post; write a full-length article.`}`;
        } else if (style_id === "fomo_style") {
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
- Bulleted/Numbered lists: Use standard unicode bullets like '•' or '-' (never use asterisks '*' or '**') or numbers (1. 2. 3.) to break down key insights, lists, or steps to avoid long text paragraphs.
- Tables: convert to plain-text stacked lists with em dashes
- Spacing: always one blank line between list/bullet items for mobile readability.
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
          if (preserve_text) {
            systemPrompt += "\nCRITICAL: The user has selected 'PRESERVE ORIGINAL TEXT'. You MUST keep the text content, sentences, and core wording exactly as provided. Do not rewrite, summarize, or alter the core hook or body text. Focus ONLY on professional formatting, clean spacing, bullet points formatting (if any), and structuring it exactly as requested in the JSON schema without altering the words.";
          }

          userPrompt = `ARTICLE/CONTENT TO CONVERT:
"${transcript}"

${webSearchContext ? `ADDITIONAL LATEST WEB SEARCH CONTEXT (Use this to include the most up-to-date and accurate facts):
${webSearchContext}
` : ""}
${seriesCount > 1 ? `SERIES CONTEXT:
You are writing Part ${index} of a ${seriesCount}-part series.
${index > 1 ? `Here are the previous parts of this series. Make sure this part builds on them, refers to the previous context, and flows logically from them without repeating the same hook structure or copying their exact bullet points:
${previousPostsText}
` : "This is Part 1 of the series. Establish the main problem, hook, and beginning context."}` : ""}
TOPIC CONTEXT (optional but improves output):
- Industry: ${user.industry || "SaaS & Tech"}
- Target audience: ${user.job_title || "Founders / Managers / Freelancers"}
- Core message you want readers to take away: ${transcript.split(".")[0] || "One actionable insight."}`;
        } else {
          systemPrompt = buildSystemPrompt();
          if (preserve_text) {
            systemPrompt += "\nCRITICAL: The user has selected 'PRESERVE ORIGINAL TEXT'. You MUST keep the text content, sentences, and core wording exactly as provided. Do not rewrite, summarize, or alter the core hook or body text. Focus ONLY on professional formatting, clean spacing, bullet points formatting (if any), and structuring it exactly as requested in the JSON schema without altering the words.";
          }
          userPrompt = `TRANSCRIPT TO REWRITE:
"${transcript}"

${webSearchContext ? `ADDITIONAL LATEST WEB SEARCH CONTEXT (Use this to include the most up-to-date and accurate facts):
${webSearchContext}
` : ""}
${seriesCount > 1 ? `SERIES CONTEXT:
You are writing Part ${index} of a ${seriesCount}-part series.
${index > 1 ? `Here are the previous parts of this series. Make sure this part builds on them, refers to the previous context, and flows logically from them without repeating the same hook structure or copying their exact bullet points:
${previousPostsText}
` : "This is Part 1 of the series. Establish the main problem, hook, and beginning context."}` : ""}
STYLE PROFILE TARGET:
${JSON.stringify(selectedStyleJson, null, 2)}

USER CONTEXT:
Industry: ${user.industry}
Title: ${user.job_title}

RECENT POST TOPICS (Avoid repeating these concepts/hooks):
${recentTopics.join("\n")}

Rewrite instructions:
${preserve_text ? `- PRESERVE ORIGINAL TEXT: Keep the text content, sentences, and wording exactly as provided. Do not rewrite the hook, body, or CTA. Focus ONLY on spacing, formatting, and layout structure.` : `- Turn the chaotic raw transcript into an elite, professional thought-leadership LinkedIn post.
- Synthesize raw spoken thoughts. DO NOT copy phrases or filler speech verbatim. Write it with high density of value, clean layout, and professional clarity.
- Structure: Start with a scroll-stopping hook, flow into the core problem or situation, deliver a clear value-add/insight, provide a concrete actionable tip, and end with an engaging CTA/question matching the target style.`}
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
          sessionId: `post-generation-${index}-` + Date.now(),
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
        resultJson.post_content = await humanizePostContent(
          resultJson.post_content,
          user.id,
          user.plan || "pro",
          `generate-${index}-` + Date.now()
        );

        let cleanedPostContent = resultJson.post_content;
        cleanedPostContent = cleanedPostContent.replace(/\*\*/g, "");
        cleanedPostContent = cleanedPostContent.replace(/^([ \t]*)\*[ \t]+/gm, "$1• ");
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

      // Save post to Database as pending_approval
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
        series_id: seriesId,
        series_index: index,
        content_type: targetContentType,
      };

      let finalThoughts = agentThoughts || "";
      let thoughtsObj: any = {};
      if (finalThoughts) {
        try {
          thoughtsObj = JSON.parse(finalThoughts);
        } catch {
          thoughtsObj = { text: finalThoughts };
        }
      }
      // Add series fallback info to agent_thoughts metadata
      thoughtsObj.series_id = seriesId;
      thoughtsObj.series_index = index;
      thoughtsObj.series_count = seriesCount;
      postPayload.agent_thoughts = JSON.stringify(thoughtsObj);

      let newPost: any = null;
      let postErr: any = null;

      try {
        const { data, error } = await db.from("posts").insert(postPayload).select().single();
        if (error) {
          // If error is due to missing columns (schema cache error), retry without those columns
          if (error.message && (error.message.includes("series_id") || error.message.includes("series_index") || error.message.includes("content_type") || error.message.includes("column"))) {
            console.warn("Inserting with new columns failed, retrying without them:", error.message);
            const fallbackPayload = { ...postPayload };
            delete fallbackPayload.series_id;
            delete fallbackPayload.series_index;
            delete fallbackPayload.content_type;
            const fallbackRes = await db.from("posts").insert(fallbackPayload).select().single();
            newPost = fallbackRes.data;
            postErr = fallbackRes.error;
          } else {
            newPost = data;
            postErr = error;
          }
        } else {
          newPost = data;
          postErr = error;
        }
      } catch (err) {
        // Fallback: Retry inserting without series_id/series_index columns if migration has not run yet
        const fallbackPayload = { ...postPayload };
        delete fallbackPayload.series_id;
        delete fallbackPayload.series_index;
        const { data, error } = await db.from("posts").insert(fallbackPayload).select().single();
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



      createdPosts.push({
        id: newPost.id,
        post_content: newPost.post_content,
        hashtags: newPost.hashtags,
        style_match_score: newPost.style_match_score,
        hook_type: resultJson.hook_type,
        post_structure: resultJson.post_structure,
        style_deviations: resultJson.style_deviations || [],
        review_suggested: resultJson.review_suggested,
        provider: llmRes.provider,
        latencyMs: llmRes.latencyMs,
        agent_thoughts: postPayload.agent_thoughts,
      });

      // Fire draft email notification (non-blocking)
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
        sendApprovalEmailInternal({
          post_id: newPost.id,
          post_content: newPost.post_content,
          hashtags: newPost.hashtags || [],
          baseUrl,
        }).catch((err) => console.warn("[generate] Email notification failed (non-blocking):", err));
      } catch (emailErr) {
        console.warn("[generate] Email notification failed (non-blocking):", emailErr);
      }
    }

    const firstPost = createdPosts[0];

    return NextResponse.json({
      success: true,
      post_id: firstPost.id,
      series_post_ids: createdPosts.map((p) => p.id),
      approval_package: {
        post_content: firstPost.post_content,
        hashtags: firstPost.hashtags,
        style_match_score: firstPost.style_match_score,
        hook_type: firstPost.hook_type,
        post_structure: firstPost.post_structure,
        style_deviations: firstPost.style_deviations || [],
        review_suggested: firstPost.review_suggested,
        provider: firstPost.provider,
        latencyMs: firstPost.latencyMs,
        agent_thoughts: firstPost.agent_thoughts,
      }
    });

  } catch (error: any) {
    console.error("Content generation failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
