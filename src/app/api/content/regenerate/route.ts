import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { buildSystemPrompt } from "../generate/route";
import { cleanJsonString } from "@/lib/utils";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

    const userPrompt = `You are editing a generated LinkedIn post based on user feedback.
ORIGINAL SPOKEN TRANSCRIPT:
"${post.transcript_corrected}"

PREVIOUS REVISION HISTORY AND FEEDBACK:
${revisionLogs}

CURRENT DIRECT USER FEEDBACK FOR NEXT VERSION:
"${feedback}"

USER CONTEXT:
Industry: ${user?.industry || "Tech"}
Title: ${user?.job_title || "Professional"}

Please rewrite the post incorporating the feedback. Make sure you don't repeat the mistakes pointed out in the revision history.
Return your response ONLY in this JSON format:
{
  "post_content": "The regenerated and refined post text...",
  "hashtags": ["hashtag1", "hashtag2"],
  "changes_made": ["List of specific changes made to address feedback"],
  "style_match_score": 9,
  "style_deviations": []
}`;

    const llmRes = await routeLLMRequest({
      useCase: "regeneration",
      messages: [
        { role: "system", content: buildSystemPrompt() },
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
