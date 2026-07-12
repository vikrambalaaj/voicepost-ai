import { NextRequest, NextResponse } from "next/server";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { cleanJsonString } from "@/lib/utils";
import { humanizeCarouselSlides } from "../../../content/generate/route";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

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
- Slide 1: Hook cover slide. It MUST NOT contain any structured points, metrics, badge, or footer.
- Slides 2 to 5: Content slides with punchy takeaways. For these content slides, include:
  - "layout": a layout style, one of: "paragraph", "points", or "metrics".
    - Choose "metrics" when the content focuses on achievements, statistics, results, growth, years, or numbers.
    - Choose "points" when teaching a process, step-by-step guide, list of tactics, or concrete lessons.
    - Choose "paragraph" when sharing a narrative, concept description, or general context.
  - "badge": a category badge (e.g. "ACTION 4", "RESULTS", "CASE STUDY", "TACTIC 1") representing the category or step label.
  - "subtitle": optional tagline summarizing the slide topic.
  - "title": slide title. Wrap exactly one key word in double asterisks ** (e.g. Focus on **Success** — And Let the Results Speak) to highlight it in the accent color. Do not use asterisks in any other fields.
  - Structured content:
    - If layout is "metrics", include a "metrics" array of exactly 3 objects, each with "value", "label", and "text".
    - If layout is "points", include a "points" array of exactly 3 objects, each with "title" and "text".
    - If layout is "paragraph", omit points and metrics arrays.
- Slide 6: Call to Action (CTA) slide. It MUST NOT contain any structured points, metrics, badge, or footer.
- Use short sentences. Max 2-3 lines per body.
- Return ONLY valid JSON, no markdown, no backticks.`;

    const userPrompt = `Convert this LinkedIn post into a structured carousel with exactly 6 slides:
"${post.post_content}"

Return this exact JSON structure:
{
  "title": "carousel title",
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "compelling **headline** (with one word highlighted)",
      "body": "swipe hook"
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
    {
      "slideNumber": 3,
      "type": "content",
      "layout": "points",
      "badge": "TACTICS",
      "title": "How to **Build** Governance",
      "subtitle": "Your Partner in Building Governance Framework",
      "points": [
        {
          "title": "Establish Ownership",
          "text": "Identify clear roles and responsibilities across the team."
        },
        {
          "title": "Continuous Review",
          "text": "Schedule recurring feedback loops to inspect and adapt."
        },
        {
          "title": "Standardize Frameworks",
          "text": "Define global templates and rules for all repositories."
        }
      ],
      "footer": "optional green highlight banner checkmark text",
      "body": "Fallback paragraph description summarizing the slide"
    },
    {
      "slideNumber": 4,
      "type": "content",
      "layout": "paragraph",
      "badge": "BACKGROUND",
      "title": "The **Reality** of Engineering",
      "subtitle": "Why building is hard",
      "body": "When we started the project, we thought it would take two weeks. The truth is, building a solid backend governance system is a journey of continuous integration and scaling up standards.",
      "footer": "optional green highlight banner checkmark text"
    },
    ... (slides 5 as content slide with similar appropriate layout),
    {
      "slideNumber": 6,
      "type": "cta",
      "title": "cta headline",
      "body": "follow for more + what they'll get"
    }
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

    // 4. Log audit event
    await logAuditEvent({
      userId,
      action: "POST_CONVERTED_CAROUSEL",
      targetType: "post",
      targetId: id,
      details: {
        previous_type: "standard",
        new_type: "carousel",
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
    console.error("Post carousel conversion failed:", err);
    return NextResponse.json({ error: err.message || "Conversion failed" }, { status: 500 });
  }
}
