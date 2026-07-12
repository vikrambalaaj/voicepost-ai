import { NextRequest, NextResponse } from "next/server";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getServiceSupabase();

    // 1. Fetch current post
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // Parse current content. If it's not a carousel, return it directly.
    let isCarousel = false;
    let carouselData: any = null;
    try {
      carouselData = JSON.parse(post.post_content || "");
      if (carouselData && (carouselData.type === "carousel" || Array.isArray(carouselData.slides))) {
        isCarousel = true;
      }
    } catch (e) {
      // Not JSON or not a carousel
    }

    if (!isCarousel || !carouselData) {
      return NextResponse.json({
        success: true,
        message: "Post is already a standard text post, no conversion needed.",
        post,
      });
    }

    // Check user plan
    const { data: user } = await db.from("users").select("plan").eq("id", userId).single();
    const userPlan = user?.plan || "free";

    // 2. Prepare LLM Prompts
    const slidesText = carouselData.slides
      .map((s: any) => `Slide ${s.slideNumber} (${s.type || "content"}):\nTitle: ${s.title || ""}\nBody: ${s.body || ""}`)
      .join("\n\n");

    const systemPrompt = `You are an expert LinkedIn copywriter. You take a structured carousel (consisting of a cover hook slide, content slides with key insights, and a call-to-action slide) and rewrite/merge it into a single cohesive, high-impact, standard LinkedIn text-based post.

RULES:
- Maintain the key lessons, core insights, hook, and CTA from the slides.
- Structure it for maximum readability on LinkedIn using line breaks, spacing, and short sentences.
- Write in a natural, engaging, professional yet punchy tone.
- Do NOT use backticks, markdown code blocks, or wrapper quotes around your output.
- Return ONLY the clean, final rewritten text of the post.`;

    const userPrompt = `Here is the structured LinkedIn carousel data to convert back into a standard text post:
Carousel Title: ${carouselData.title || ""}

${slidesText}

Please write the final, high-impact LinkedIn post text based on this carousel:`;

    const result = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId,
      userPlan: userPlan as any,
      sessionId: "carousel-to-text-" + Date.now(),
      responseFormat: "text",
      maxTokens: 1500,
    });

    let rewrittenText = result.content
      .replace(/```markdown\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const nextRevisionNum = (post.current_revision || 1) + 1;

    // 3. Update post in DB
    const { data: updatedPost, error: updateErr } = await db
      .from("posts")
      .update({
        post_content: rewrittenText,
        current_revision: nextRevisionNum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 4. Save new revision row
    await db.from("post_revisions").insert({
      post_id: id,
      revision_number: nextRevisionNum,
      post_content: rewrittenText,
      hashtags: post.hashtags || [],
      feedback_given: "Converted from carousel to standard text post",
      changes_made: ["Converted visual carousel to text layout"],
      provider_used: result.provider,
    });

    // 5. Log audit event
    await logAuditEvent({
      userId,
      action: "POST_CONVERTED_NORMAL",
      targetType: "post",
      targetId: id,
      details: {
        previous_type: "carousel",
        new_type: "standard",
        revision_number: nextRevisionNum,
        provider: result.provider,
      },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      post: updatedPost,
      current_revision: nextRevisionNum,
    });

  } catch (err: any) {
    console.error("Post carousel-to-text conversion failed:", err);
    return NextResponse.json({ error: err.message || "Conversion failed" }, { status: 500 });
  }
}
