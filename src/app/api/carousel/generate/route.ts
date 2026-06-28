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
- Title: 4-8 words, strong hook or claim. Wrap exactly one key word in double asterisks ** (e.g. Focus on **Results** — Let The Numbers Speak) to highlight it in the selected accent color. Do not use asterisks in any other fields.
- Content Slides (non-cover, non-cta): Must contain a "layout" property which is one of: "paragraph", "points", or "metrics".
  - Choose "metrics" ONLY when the topic itself is inherently about statistics, benchmarks, or measurable data (e.g. "email open rate stats", "React performance benchmarks"). Do NOT use metrics just to fill space.
  - Choose "points" when teaching a process, step-by-step guide, list of tactics, or concrete lessons about the topic.
  - Choose "paragraph" when sharing a narrative, concept description, insight, or general context about the topic.
- Category Badge: Content slides should include a "badge" property representing the category or step label, RELEVANT to the topic (e.g., "INSIGHT 1", "TACTIC 2", "MYTH", "FRAMEWORK").
- Tagline/Subtitle: Content slides should include an optional "subtitle" summarizing the slide topic in one short sentence.
- Structured Content:
  - If layout is "metrics", include a "metrics" array of exactly 3 objects, each with "value" (stat or number directly about the topic), "label" (brief bold label about the topic), and "text" (one-sentence explanation tied to the topic).
  - If layout is "points", include a "points" array of exactly 3 objects, each with "title" (short bold heading about the topic) and "text" (one-sentence explanation about the topic).
  - If layout is "paragraph", include only a "body" field (2-3 short sentences). Omit points and metrics arrays.
- Cover slide (type "cover") and CTA slide (type "cta") MUST NOT contain structured points, metrics, badge, or footer.
- Return ONLY valid JSON, no markdown, no backticks.
- Every value in the JSON must be a simple plain text string.

CRITICAL GROUNDING RULES — VIOLATING THESE MAKES THE OUTPUT WRONG:
- ALL slide content MUST be 100% derived from the user's EXACT topic. Do not deviate.
- NEVER generate a "case study" or "client story" slide. Do not invent client names, company names, project names, or case studies. This is strictly forbidden.
- NEVER use phrases like "Our client", "A client of ours", "Success Story", "A Client's Journey", "Real-World Example". These are banned.
- The example JSON below is ONLY a FORMAT GUIDE. Its values are FAKE PLACEHOLDERS — replace every single value with content grounded in the user's actual topic.
- If the topic is about "cold email outreach", every slide must be about cold email outreach. If it's about "React performance", every slide must be about React performance. NEVER drift to adjacent or generic topics.
- Metrics and statistics must be directly relevant to the topic — do NOT fabricate unrelated generic business stats.
- Badge labels, subtitles, body text, and footers must all reflect the specific topic, not generic corporate jargon.`;

    const userPrompt = `Create a LinkedIn carousel with exactly ${slideCount} slides about: "${topic}"
Industry context: ${industry}
Tone: ${tone}

STRICT REQUIREMENTS:
1. Every single slide must be 100% about "${topic}". All metrics, points, titles, badges, and subtitles must come directly from this topic.
2. Do NOT generate any "case study", "client journey", or "success story" slide. Do NOT mention clients.
3. Do NOT use generic corporate statistics unrelated to the topic.
4. Prefer "points" or "paragraph" layouts over "metrics" unless the topic is specifically about measurable data.

Use the JSON structure below as a FORMAT GUIDE ONLY — replace all placeholder values with real content about "${topic}":
{
  "title": "[Short carousel title about ${topic}]",
  "slides": [
    {
      "slideNumber": 1,
      "type": "cover",
      "title": "[Strong hook headline about ${topic} with one **word** highlighted]",
      "body": "[1-2 sentence hook about ${topic} that makes the reader want to swipe]"
    },
    {
      "slideNumber": 2,
      "type": "content",
      "layout": "points",
      "badge": "[RELEVANT BADGE FOR ${topic.toUpperCase()}]",
      "title": "[Actionable title about ${topic} with one **word** highlighted]",
      "subtitle": "[One-sentence subtitle specific to this ${topic} slide]",
      "points": [
        { "title": "[First key point about ${topic}]", "text": "[One-sentence explanation about ${topic}]" },
        { "title": "[Second key point about ${topic}]", "text": "[One-sentence explanation about ${topic}]" },
        { "title": "[Third key point about ${topic}]", "text": "[One-sentence explanation about ${topic}]" }
      ]
    },
    {
      "slideNumber": 3,
      "type": "content",
      "layout": "paragraph",
      "badge": "[RELEVANT BADGE FOR ${topic.toUpperCase()}]",
      "title": "[Insight title about ${topic} with one **word** highlighted]",
      "subtitle": "[Why this insight about ${topic} matters]",
      "body": "[2-3 short sentences sharing a perspective or insight directly about ${topic}]",
      "footer": "[Key takeaway about ${topic}]"
    },
    {
      "slideNumber": 4,
      "type": "content",
      "layout": "points",
      "badge": "[RELEVANT BADGE FOR ${topic.toUpperCase()}]",
      "title": "[Another actionable title about ${topic} with one **word** highlighted]",
      "points": [
        { "title": "[First actionable point about ${topic}]", "text": "[One-sentence explanation]" },
        { "title": "[Second actionable point about ${topic}]", "text": "[One-sentence explanation]" },
        { "title": "[Third actionable point about ${topic}]", "text": "[One-sentence explanation]" }
      ]
    },
    {
      "slideNumber": ${slideCount},
      "type": "cta",
      "title": "[CTA headline about ${topic} with one **word** highlighted]",
      "body": "[Follow for more insights like this about ${topic}]"
    }
  ],
  "suggestedHashtags": ["[hashtag1 for ${topic}]", "[hashtag2]", "[hashtag3]", "[hashtag4]", "[hashtag5]", "[hashtag6]"]
}

Generate ${slideCount} slides total. All content must be entirely and specifically about "${topic}". Never copy placeholder text — replace every placeholder with real, valuable, topic-specific content.`;

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
          "carousel-" + Date.now(),
          topic
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
