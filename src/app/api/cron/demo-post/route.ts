import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Validate cron secret to prevent unauthorized triggering
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();
  const userId = "00000000-0000-0000-0000-000000000000"; // Demo User ID

  try {
    // 2. Fetch the demo user to make sure they exist
    const { data: user, error: userErr } = await db
      .from("users")
      .select("plan, posts_used_this_week, posts_limit_weekly")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "Demo user not found" }, { status: 404 });
    }

    // 3. Generate a high-impact, inspiring software engineering text post using LLM router
    const systemPrompt = `You are a professional LinkedIn content ghostwriter. 
Write a high-impact standard text post about clean code, software engineering best practices, or building serverless architectures on Vercel. 
Do not use asterisks (*) or markdown bold formatting. Structure with a strong hook, actionable advice, and a conversational CTA.
Output ONLY the post content. No markdown wrappers, no backticks, no JSON.`;

    const generatedRes = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Write a short post highlighting one core engineering lesson." }
      ],
      userId,
      userPlan: user.plan || "pro",
      sessionId: "cron-demo-generation-" + Date.now(),
    });

    const postContent = generatedRes.content.trim();
    const mockHashtags = ["softwareengineering", "webdev", "cleanarchitecture", "developerlife"];

    // 4. Save the generated post into the database
    const { data: post, error: postErr } = await db
      .from("posts")
      .insert({
        user_id: userId,
        post_title: "Automated Demo Post",
        post_content: postContent,
        hashtags: mockHashtags,
        content_type: "post",
        status: "pending_approval",
        creator_style_id: "justin_welsh"
      })
      .select()
      .single();

    if (postErr || !post) {
      throw new Error(`Failed to save demo post: ${postErr?.message}`);
    }

    // 5. Automatically publish the demo post
    // Fetch mock LinkedIn account for user
    const { data: accounts } = await db
      .from("linkedin_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .limit(1);

    if (!accounts || accounts.length === 0) {
      throw new Error("No primary LinkedIn account found for demo user.");
    }

    const account = accounts[0];
    const mockPostId = `mock_share_${Math.random().toString(36).substring(2, 12)}`;
    const mockPermalink = `https://www.linkedin.com/feed/update/urn:li:share:${mockPostId}`;

    // Update status to published
    await db
      .from("posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        linkedin_post_id: mockPostId,
        linkedin_post_url: mockPermalink,
      })
      .eq("id", post.id);

    // Update user limits
    await db
      .from("users")
      .update({
        posts_used_this_week: user.posts_used_this_week + 1,
      })
      .eq("id", userId);

    // Log the publication event to audit_logs
    await logAuditEvent({
      userId,
      action: "POST_PUBLISHED",
      targetType: "post",
      targetId: post.id,
      details: {
        content_type: "post",
        automated_cron: true,
        linkedin_post_id: mockPostId,
        linkedin_post_url: mockPermalink
      }
    });

    console.log(`[cron/demo-post] Automated demo post created and published: ${post.id}`);
    return NextResponse.json({
      success: true,
      post_id: post.id,
      published_url: mockPermalink,
      scheduled_interval: "every 4 days"
    });

  } catch (error: any) {
    console.error("[cron/demo-post] Failed to execute cron post:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
