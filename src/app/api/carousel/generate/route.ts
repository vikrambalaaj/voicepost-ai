import { NextRequest, NextResponse } from "next/server";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { cleanJsonString } from "@/lib/utils";
import { humanizeCarouselSlides } from "../../content/generate/route";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, slideCount = 6, tone = "professional", industry = "SaaS & Tech" } = body;

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getServiceSupabase();
    const { data: user } = await db.from("users").select("plan").eq("id", userId).single();
    const userPlan = user?.plan || "free";

    const systemPrompt = `You are an expert LinkedIn carousel content creator. You create scroll-stopping, high-value carousel posts that teach something actionable.

RULES:
- Each slide must be punchy, scannable, and valuable on its own.
- Use short sentences. Max 2-3 lines per body.
- Title: 4-8 words, strong hook or claim.
- Body: 1-3 sentences, specific and actionable. For content slides (non-cover, non-cta), if a list or multi-step takeaway is being presented, write exactly 3 bullet points using standard unicode bullet characters (•) instead of a text paragraph.
- First slide (cover): compelling hook that makes people want to swipe. It MUST NOT contain any bullet points.
- Last slide (CTA): clear call to action. It MUST NOT contain any bullet points.
- NO corporate fluff, NO "leverage", NO "delve".
- Return ONLY valid JSON, no markdown, no backticks.
- Every value in the JSON must be a simple plain text string.
- NEVER use asterisks (*) or double asterisks (**) anywhere in the title, body, or other text of the slides. LinkedIn and visual carousels do not support markdown formatting. Keep the text strictly plain text without any asterisk symbols.`;

    const userPrompt = `Create a LinkedIn carousel with exactly ${slideCount} slides about: "${topic}"
Industry context: ${industry}
Tone: ${tone}
 
Return this exact JSON structure:
{
  "title": "carousel title for reference",
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
    ... (slides 3 to ${slideCount - 1} as content slides),
    {
      "slideNumber": ${slideCount},
      "type": "cta",
      "title": "cta headline",
      "body": "follow for more + what they'll get (Strictly NO bullet points here)"
    }
  ],
  "suggestedHashtags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"]
}`;

    const result = await routeLLMRequest({
      useCase: "content_generation",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId,
      userPlan: userPlan as any,
      sessionId: "carousel-generation-" + Date.now(),
      responseFormat: "json",
      maxTokens: 2000,
    });

    // Parse LLM response
    let parsed: any;
    try {
      const cleaned = result.content
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(cleanJsonString(cleaned));
    } catch {
      // Try to extract JSON from response
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

    return NextResponse.json({
      success: true,
      carousel: parsed,
      provider: result.provider,
    });
  } catch (err: any) {
    console.error("Carousel generation error:", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}
