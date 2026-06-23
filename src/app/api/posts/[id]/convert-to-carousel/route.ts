import { NextRequest, NextResponse } from "next/server";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { cleanJsonString } from "@/lib/utils";
import { humanizeCarouselSlides } from "../../../content/generate/route";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check user plan
    const { data: user } = await db.from("users").select("plan").eq("id", userId).single();
    const userPlan = user?.plan || "free";

    const systemPrompt = `You are an expert LinkedIn carousel converter. You take a standard text-based LinkedIn post and convert it into a scroll-stopping, high-value visual carousel.

RULES:
- Restructure the input text into exactly 6 logical slides.
- Slide 1: Hook cover slide.
- Slides 2 to 5: Content slides with punchy takeaways.
- Slide 6: Call to Action (CTA) slide.
- Use short sentences. Max 2-3 lines per body.
- Return ONLY valid JSON, no markdown, no backticks.
- NEVER use asterisks (*) or double asterisks (**) in slide titles or body.`;

    const userPrompt = `Convert this LinkedIn post into a structured carousel with exactly 6 slides:
"${post.post_content}"

Return this exact JSON structure:
{
  "title": "carousel title",
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "hook headline",
      "body": "swipe hook"
    },
    ...
  ],
  "suggestedHashtags": ["tag1", "tag2"]
}`;

    const result = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId,
      userPlan: userPlan as any,
      sessionId: "carousel-conversion-" + Date.now(),
      responseFormat: "json",
      maxTokens: 2000,
    });

    let parsed: any;
    try {
      const cleaned = result.content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleanJsonString(cleaned));
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(cleanJsonString(match[0]));
      } else {
        throw new Error("Could not parse LLM response as JSON");
      }
    }

    if (parsed) {
      if (parsed.title) {
        parsed.title = parsed.title.replace(/\*\*/g, "").replace(/\*/g, "");
      }
      if (Array.isArray(parsed.slides)) {
        parsed.slides = await humanizeCarouselSlides(
          parsed.slides,
          userId,
          userPlan as any,
          "carousel-" + Date.now()
        );

        parsed.slides = parsed.slides.map((slide: any) => {
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
      }
    }

    const nextRevisionNum = (post.current_revision || 1) + 1;
    const serializedCarousel = JSON.stringify({
      type: "carousel",
      title: parsed.title || "Converted Carousel",
      slides: parsed.slides,
      templateId: "bold_impact",
      accentColor: "#3B82F6",
    });

    // 2. Update post
    const { data: updatedPost, error: updateErr } = await db
      .from("posts")
      .update({
        post_content: serializedCarousel,
        current_revision: nextRevisionNum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 3. Save new revision row
    await db.from("post_revisions").insert({
      post_id: id,
      revision_number: nextRevisionNum,
      post_content: serializedCarousel,
      hashtags: post.hashtags || [],
      feedback_given: "Converted to carousel layout",
      changes_made: ["Converted text post to a visual carousel"],
      provider_used: result.provider,
    });

    return NextResponse.json({
      success: true,
      post: updatedPost,
      current_revision: nextRevisionNum,
    });

  } catch (err: any) {
    console.error("Post carousel conversion failed:", err);
    return NextResponse.json({ error: err.message || "Conversion failed" }, { status: 500 });
  }
}
