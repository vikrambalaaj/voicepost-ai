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
    const { post_id, feedback, document_text, style_type, style_id } = body;

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

    // Update style profile in the DB if requested
    if (style_type && style_id) {
      await db
        .from("posts")
        .update({ style_type, style_id })
        .eq("id", post_id);
      post.style_type = style_type;
      post.style_id = style_id;
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

    // Fetch selected style profile JSON
    let selectedStyleJson: any = null;
    if (post.style_id) {
      if (post.style_type === "expert") {
        const { data: exp } = await db.from("expert_styles").select("style_json").eq("id", post.style_id).single();
        selectedStyleJson = exp?.style_json || null;
      } else {
        const { data: cust } = await db.from("custom_styles").select("style_json").eq("id", post.style_id).single();
        selectedStyleJson = cust?.style_json || null;
      }
    }
    const styleContext = selectedStyleJson 
      ? `\n\nWRITING STYLE DNA INSTRUCTIONS (Strictly adhere to this formatting, tone, and sentence length style):\n${JSON.stringify(selectedStyleJson, null, 2)}`
      : "";

    let systemPrompt = buildSystemPrompt() + styleContext;
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
- Title: 4-8 words, strong hook or claim. Wrap exactly one key word in double asterisks ** (e.g. Focus on **Success** — And Let the Results Speak) to highlight it in the selected accent color. Do not use asterisks in any other fields.
- Content Slides (type "content"): Must contain a "layout" property which is one of: "paragraph", "points", or "metrics".
  - Choose "metrics" when the content focuses on achievements, statistics, results, growth, years, or numbers.
  - Choose "points" when teaching a process, step-by-step guide, list of tactics, or concrete lessons.
  - Choose "paragraph" when sharing a narrative, concept description, or general context.
- Category Badge: Content slides should include a "badge" property (e.g., "ACTION 4", "RESULTS", "CASE STUDY", "TACTIC 1") representing the category or step label.
- Tagline/Subtitle: Content slides should include an optional "subtitle" summarizing the slide topic.
- Structured Content:
  - If layout is "metrics", include a "metrics" array of exactly 3 objects, each with "value", "label", and "text".
  - If layout is "points", include a "points" array of exactly 3 objects, each with "title" and "text".
  - If layout is "paragraph", omit points and metrics arrays.
- Cover slide (type "cover") and CTA slide (type "cta") MUST NOT have structured points, metrics, badge, or footer.
- Return your response ONLY in this JSON format:
{
  "title": "carousel title for reference",
  "templateId": "${originalCarouselData?.templateId || "bold_impact"}",
  "accentColor": "${originalCarouselData?.accentColor || "#3B82F6"}",
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "hook headline (with one word in **stars**)",
      "body": "1-2 sentence hook that makes them swipe"
    },
    {
      "slideNumber": 2,
      "type": "content",
      "layout": "metrics",
      "badge": "ACTION 4 + RESULTS",
      "title": "Focus on **Success** — And Let the Results Speak",
      "subtitle": "optional tagline summarizing the topic",
      "body": "Paragraph description explaining the context of these metrics",
      "metrics": [
        {
          "value": "2025",
          "label": "Ended on a High",
          "text": "Closed the year on a strong positive note after navigating the trough"
        },
        {
          "value": "1",
          "label": "New Greenfield Win",
          "text": "Successful Private Cloud S/4HANA Greenfield Implementation to begin 2026"
        },
        {
          "value": "2",
          "label": "Recognitions",
          "text": "Award for Excellence + acknowledgment from business users"
        }
      ],
      "footer": "optional green highlight banner checkmark text"
    },
    ... (additional content slides with similar appropriate layout),
    {
      "slideNumber": ${originalCarouselData?.slides?.length || 6},
      "type": "cta",
      "title": "cta headline (with one word in **stars**)",
      "body": "follow for more + what they'll get"
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
        let cleanSubtitle = slide.subtitle ? slide.subtitle.replace(/\*\*/g, "").replace(/\*/g, "") : undefined;
        let cleanFooter = slide.footer ? slide.footer.replace(/\*\*/g, "").replace(/\*/g, "") : undefined;
        let cleanBadge = slide.badge ? slide.badge.replace(/\*\*/g, "").replace(/\*/g, "") : undefined;
        
        let cleanPoints = undefined;
        if (Array.isArray(slide.points)) {
          cleanPoints = slide.points.map((pt: any) => ({
            title: (pt.title || "").replace(/\*\*/g, "").replace(/\*/g, ""),
            text: (pt.text || "").replace(/\*\*/g, "").replace(/\*/g, "")
          }));
        }

        let cleanMetrics = undefined;
        if (Array.isArray(slide.metrics)) {
          cleanMetrics = slide.metrics.map((m: any) => ({
            value: (m.value || "").replace(/\*\*/g, "").replace(/\*/g, ""),
            label: (m.label || "").replace(/\*\*/g, "").replace(/\*/g, ""),
            text: (m.text || "").replace(/\*\*/g, "").replace(/\*/g, "")
          }));
        }

        // Clean single asterisks, keep double asterisks in title
        cleanTitle = cleanTitle.replace(/^([ \t]*)\*[ \t]+/gm, "$1• ");
        cleanBody = cleanBody.replace(/\*\*/g, "").replace(/^([ \t]*)\*[ \t]+/gm, "$1• ").replace(/\*/g, "");
        return {
          ...slide,
          title: cleanTitle,
          body: cleanBody,
          subtitle: cleanSubtitle,
          footer: cleanFooter,
          badge: cleanBadge,
          points: cleanPoints,
          metrics: cleanMetrics,
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
