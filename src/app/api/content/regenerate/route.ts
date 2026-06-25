import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { buildSystemPrompt, humanizePostContent, humanizeCarouselSlides } from "../generate/route";
import { cleanJsonString } from "@/lib/utils";
import { getAuthenticatedUserId } from "@/lib/auth";



export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { post_id, feedback, document_text } = body;

    if (!post_id || !feedback) {
      return NextResponse.json({ error: "post_id and feedback are required" }, { status: 400 });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Fetch current post and verify ownership
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .eq("user_id", userId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // 2. Fetch past revisions
    const { data: revisions } = await db
      .from("post_revisions")
      .select("revision_number, post_content, feedback_given, changes_made")
      .eq("post_id", post_id)
      .order("revision_number", { ascending: true });

    // Fetch user details for plan
    const { data: user } = await db
      .from("users")
      .select("id, plan, industry, job_title")
      .eq("id", post.user_id)
      .single();

    const userPlan = user?.plan || "free";

    // 3. Build revision history logs for AI context
    const revisionLogs = revisions?.map((rev: any) => {
      return `REVISION #${rev.revision_number}:
Content: "${rev.post_content}"
User Feedback given for this revision: "${rev.feedback_given || "Initial draft"}"
Changes made in response: ${rev.changes_made?.join(", ") || "None (Initial)"}`;
    }).join("\n\n") || "";

    // Check if original post is a carousel
    let isCarousel = false;
    let originalCarouselData: any = null;
    try {
      const parsed = JSON.parse(post.post_content || "");
      if (parsed.type === "carousel" || parsed.slides) {
        isCarousel = true;
        originalCarouselData = parsed;
      }
    } catch (e) {
      // Not a carousel
    }

    const documentContext = document_text
      ? `\n\nADDITIONAL REFERENCE DOCUMENT CONTEXT (Use this to extract and incorporate the most up-to-date and accurate facts/content):\n"${document_text}"`
      : "";

    let systemPrompt = buildSystemPrompt();
    let userPrompt = "";

    if (isCarousel) {
      userPrompt = `You are editing a generated LinkedIn Carousel based on user feedback.
ORIGINAL SPOKEN TRANSCRIPT:
"${post.transcript_corrected}"

PREVIOUS REVISION HISTORY AND FEEDBACK:
${revisionLogs}

CURRENT DIRECT USER FEEDBACK FOR NEXT VERSION:
"${feedback}"${documentContext}

USER CONTEXT:
Industry: ${user?.industry || "Tech"}
Title: ${user?.job_title || "Professional"}

Rewrite instructions:
- Incorporate the user feedback into the carousel title and slides. Avoid repeating any of the style deviations or issues highlighted in the feedback history.
- Maintain a highly polished, professional thought-leadership LinkedIn carousel structure.
- Each slide must be punchy, scannable, and valuable. Max 2-3 lines per body.
- For content slides (type "content"), if a list or multi-step takeaway is being presented, write exactly 3 bullet points using standard unicode bullet characters (•) instead of a text paragraph.
- Cover slide (type "cover") and CTA slide (type "cta") MUST NOT have any bullet points under any circumstances.
- Title: 4-8 words, strong claim or hook.
- NO corporate fluff, NO "leverage", NO "delve".
- NEVER use asterisks (*) or double asterisks (**) anywhere in the title, body, or other text of the slides. LinkedIn and visual carousels do not support markdown formatting. Keep the text strictly plain text without any asterisk symbols.

Return your response ONLY in this JSON format:
{
  "title": "carousel title for reference",
  "templateId": "${originalCarouselData?.templateId || "bold_impact"}",
  "accentColor": "${originalCarouselData?.accentColor || "#3B82F6"}",
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "hook headline (4-8 words)",
      "body": "1-2 sentence hook that makes them swipe (Strictly NO bullet points here)"
    },
    {
      "slideNumber": 2,
      "type": "content",
      "title": "slide title",
      "body": "exactly 3 bullet points starting with '• ' (e.g. • Bullet 1\\n• Bullet 2\\n• Bullet 3) when presenting points or insights, otherwise a punchy 2-3 sentence insight"
    },
    ... (additional content slides),
    {
      "slideNumber": ${originalCarouselData?.slides?.length || 6},
      "type": "cta",
      "title": "cta headline",
      "body": "follow for more + what they'll get (Strictly NO bullet points here)"
    }
  ],
  "suggestedHashtags": ["hashtag1", "hashtag2"],
  "changes_made": ["List of specific changes made to address feedback"],
  "style_match_score": 9,
  "style_deviations": []
}`;
    } else {
      if (post.style_id === "fomo_style") {
        systemPrompt = `You are a LinkedIn content strategist and formatting expert. You are refining a post based on user feedback.
Take the article provided and reformat it into a high-engagement LinkedIn post using FOMO-driven writing and LinkedIn's native rendering constraints.

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

Return your response ONLY in this JSON format:
{
  "post_content": "The regenerated and refined post text...",
  "hashtags": ["hashtag1", "hashtag2"],
  "changes_made": ["List of specific changes made to address feedback"],
  "style_match_score": 10,
  "style_deviations": []
}`;

        userPrompt = `ORIGINAL SPOKEN TRANSCRIPT:
"${post.transcript_corrected}"

PREVIOUS REVISION HISTORY AND FEEDBACK:
${revisionLogs}

CURRENT DIRECT USER FEEDBACK FOR NEXT VERSION:
"${feedback}"${documentContext}

TOPIC CONTEXT:
- Industry: ${user?.industry || "SaaS & Tech"}
- Target audience: ${user?.job_title || "Founders / Managers / Freelancers"}
- Core message you want readers to take away: ${post.transcript_corrected?.split(".")[0] || "One actionable insight."}`;
      } else {
        userPrompt = `You are editing a generated LinkedIn post based on user feedback.
ORIGINAL SPOKEN TRANSCRIPT:
"${post.transcript_corrected}"

PREVIOUS REVISION HISTORY AND FEEDBACK:
${revisionLogs}

CURRENT DIRECT USER FEEDBACK FOR NEXT VERSION:
"${feedback}"${documentContext}

USER CONTEXT:
Industry: ${user?.industry || "Tech"}
Title: ${user?.job_title || "Professional"}

Rewrite instructions:
- Incorporate the user feedback. Avoid repeating any of the style deviations or issues highlighted in the feedback history.
- Maintain a highly polished, professional thought-leadership LinkedIn post structure (compelling hook, clear problem/insight delivery, concrete advice, engagement CTA).
- DO NOT copy the feedback or transcript verbatim. Keep the tone sophisticated, direct, and elite.
- NEVER use asterisks (*) or double asterisks (**) anywhere in the generated post content. Use unicode bullets (• or -) if bullets are needed, and CAPITAL LETTERS or line spacing for emphasis/headers.

Return your response ONLY in this JSON format:
{
  "post_content": "The regenerated and refined post text...",
  "hashtags": ["hashtag1", "hashtag2"],
  "changes_made": ["List of specific changes made to address feedback"],
  "style_match_score": 9,
  "style_deviations": []
}`;
      }
    }

    const llmRes = await routeLLMRequest({
      useCase: "regeneration",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId: post.user_id,
      userPlan: userPlan as any,
      sessionId: "post-regenerate-" + Date.now(),
      responseFormat: "json",
      enableSearch: true,
    });

    let resultJson: any = {};
    try {
      resultJson = JSON.parse(cleanJsonString(llmRes.content));
    } catch (e) {
      const match = llmRes.content.match(/\{[\s\S]*\}/);
      if (match) {
        resultJson = JSON.parse(cleanJsonString(match[0]));
      } else {
        throw new Error("Failed to parse AI JSON response: " + llmRes.content);
      }
    }

    if (isCarousel) {
      if (Array.isArray(resultJson.slides)) {
        resultJson.slides = await humanizeCarouselSlides(
          resultJson.slides,
          post.user_id,
          userPlan as any,
          "regenerate-carousel-" + Date.now()
        );
      }
      // Map flat JSON structure back to Carousel schema format
      const slides = (resultJson.slides || []).map((slide: any) => {
        let cleanTitle = slide.title || "";
        let cleanBody = slide.body || "";
        cleanTitle = cleanTitle.replace(/\*\*/g, "").replace(/^([ \t]*)\*[ \t]+/gm, "$1• ").replace(/\*/g, "");
        cleanBody = cleanBody.replace(/\*\*/g, "").replace(/^([ \t]*)\*[ \t]+/gm, "$1• ").replace(/\*/g, "");
        return {
          ...slide,
          title: cleanTitle,
          body: cleanBody,
        };
      });

      const carouselObj = {
        type: "carousel",
        title: (resultJson.title || "VoicePost Carousel").replace(/\*\*/g, "").replace(/\*/g, ""),
        templateId: resultJson.templateId || originalCarouselData?.templateId || "bold_impact",
        accentColor: resultJson.accentColor || originalCarouselData?.accentColor || "#3B82F6",
        slides: slides,
      };
      resultJson.post_content = JSON.stringify(carouselObj);
      resultJson.hashtags = resultJson.suggestedHashtags || [];
    } else if (resultJson.post_content) {
      resultJson.post_content = await humanizePostContent(
        resultJson.post_content,
        post.user_id,
        userPlan as any,
        "regenerate-" + Date.now()
      );
      let cleanedPostContent = resultJson.post_content;
      cleanedPostContent = cleanedPostContent.replace(/\*\*/g, "");
      cleanedPostContent = cleanedPostContent.replace(/^([ \t]*)\*[ \t]+/gm, "$1• ");
      cleanedPostContent = cleanedPostContent.replace(/\*/g, "");
      resultJson.post_content = cleanedPostContent;
    }

    const nextRevisionNum = (post.current_revision || 1) + 1;

    let matchScore = parseInt(resultJson.style_match_score, 10);
    if (isNaN(matchScore)) {
      matchScore = 8;
    } else if (matchScore >= 10 && matchScore <= 100) {
      matchScore = Math.round(matchScore / 10);
    }
    matchScore = Math.max(1, Math.min(10, matchScore));

    // 4. Update parent post
    const { data: updatedPost, error: updateErr } = await db
      .from("posts")
      .update({
        post_content: resultJson.post_content,
        hashtags: resultJson.hashtags || [],
        current_revision: nextRevisionNum,
        style_match_score: matchScore,
        status: "pending_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("id", post_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 5. Save new revision row
    await db.from("post_revisions").insert({
      post_id: post_id,
      revision_number: nextRevisionNum,
      post_content: resultJson.post_content,
      hashtags: resultJson.hashtags,
      feedback_given: feedback,
      changes_made: resultJson.changes_made || [],
      provider_used: llmRes.provider,
      model_used: llmRes.model,
      style_match_score: matchScore,
      latency_ms: llmRes.latencyMs,
    });

    return NextResponse.json({
      success: true,
      post_id: post_id,
      current_revision: nextRevisionNum,
      approval_package: {
        post_content: updatedPost.post_content,
        hashtags: updatedPost.hashtags,
        style_match_score: updatedPost.style_match_score,
        changes_made: resultJson.changes_made || [],
        provider: llmRes.provider,
        latencyMs: llmRes.latencyMs,
      }
    });

  } catch (error: any) {
    console.error("Content regeneration failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
