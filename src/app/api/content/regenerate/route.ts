import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { buildSystemPrompt } from "../generate/route";
import { cleanJsonString } from "@/lib/utils";



export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { post_id, feedback } = body;

    if (!post_id || !feedback) {
      return NextResponse.json({ error: "post_id and feedback are required" }, { status: 400 });
    }

    // 1. Fetch current post
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
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

    let systemPrompt = buildSystemPrompt();
    let userPrompt = "";

    if (isCarousel) {
      userPrompt = `You are editing a generated LinkedIn Carousel based on user feedback.
ORIGINAL SPOKEN TRANSCRIPT:
"${post.transcript_corrected}"

PREVIOUS REVISION HISTORY AND FEEDBACK:
${revisionLogs}

CURRENT DIRECT USER FEEDBACK FOR NEXT VERSION:
"${feedback}"

USER CONTEXT:
Industry: ${user?.industry || "Tech"}
Title: ${user?.job_title || "Professional"}

Rewrite instructions:
- Incorporate the user feedback into the carousel title and slides. Avoid repeating any of the style deviations or issues highlighted in the feedback history.
- Maintain a highly polished, professional thought-leadership LinkedIn carousel structure.
- Each slide must be punchy, scannable, and valuable. Max 2-3 lines per body.
- Title: 4-8 words, strong claim or hook. Do NOT use ** or markdown bold tags inside values.
- NO corporate fluff, NO "leverage", NO "delve".

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
      "body": "1-2 sentence hook that makes them swipe",
      "emoji": "emoji"
    },
    {
      "slideNumber": 2,
      "type": "content",
      "title": "slide title",
      "body": "2-3 sentence insight",
      "emoji": "emoji"
    },
    ... (additional content slides),
    {
      "slideNumber": ${originalCarouselData?.slides?.length || 6},
      "type": "cta",
      "title": "cta headline",
      "body": "follow for more + what they'll get",
      "emoji": "🎯"
    }
  ],
  "suggestedHashtags": ["hashtag1", "hashtag2"],
  "changes_made": ["List of specific changes made to address feedback"],
  "style_match_score": 9,
  "style_deviations": []
}`;
    } else {
      if (post.style_id === "fomo_style") {
        systemPrompt = `You are a LinkedIn content strategist who writes high-impression, professional posts.
You are refining a post based on user feedback.

Refine the post using these rules:

TONE & STYLE:
- FOMO-driven opening line that stops the scroll
- Professional, authoritative, zero fluff
- No emoji, no casual language
- Write like a senior industry expert, not a content creator

STRUCTURE:
- Line 1: Bold provocative statement or uncomfortable truth
- Line 2-3: Short setup that creates tension or curiosity
- Bullet section: 3-4 grouped bullet clusters with bold headers
  (each bullet is one sharp, specific insight — no padding)
- Pre-close: One sentence that reinforces the cost of inaction
- Close: One direct question that triggers comments

CONSTRAINTS:
- No preamble, no "In today's world", no "Let's dive in"
- Each bullet must contain a specific fact, number, or action — no vague statements
- Total length: 250–350 words
- End with one question to drive engagement

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
"${feedback}"

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
"${feedback}"

USER CONTEXT:
Industry: ${user?.industry || "Tech"}
Title: ${user?.job_title || "Professional"}

Rewrite instructions:
- Incorporate the user feedback. Avoid repeating any of the style deviations or issues highlighted in the feedback history.
- Maintain a highly polished, professional thought-leadership LinkedIn post structure (compelling hook, clear problem/insight delivery, concrete advice, engagement CTA).
- DO NOT copy the feedback or transcript verbatim. Keep the tone sophisticated, direct, and elite.

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
      // Map flat JSON structure back to Carousel schema format
      const carouselObj = {
        type: "carousel",
        title: resultJson.title || "VoicePost Carousel",
        templateId: resultJson.templateId || originalCarouselData?.templateId || "bold_impact",
        accentColor: resultJson.accentColor || originalCarouselData?.accentColor || "#3B82F6",
        slides: resultJson.slides || [],
      };
      resultJson.post_content = JSON.stringify(carouselObj);
      resultJson.hashtags = resultJson.suggestedHashtags || [];
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
