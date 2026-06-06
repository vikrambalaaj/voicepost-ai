import { NextRequest, NextResponse } from "next/server";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { cleanJsonString } from "@/lib/utils";

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
- Each slide must be punchy, scannable, and valuable on its own
- Use short sentences. Max 2-3 lines per body
- Title: 4-8 words, strong hook or claim (do NOT use markdown bold ** tags in JSON)
- Body: 1-3 sentences, specific and actionable
- First slide (cover): compelling hook that makes people want to swipe
- Last slide (CTA): clear call to action
- NO corporate fluff, NO "leverage", NO "delve"
- Return ONLY valid JSON, no markdown, no backticks
- Every value in the JSON must be a simple plain text string. Do NOT use ** or other markdown bold formatting inside keys or values.`;

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
      "body": "1-2 sentence hook that makes them swipe",
      "emoji": "single relevant emoji"
    },
    {
      "slideNumber": 2,
      "type": "content",
      "title": "slide title",
      "body": "2-3 sentence insight",
      "emoji": "single relevant emoji"
    },
    ... (slides 3 to ${slideCount - 1} as content slides),
    {
      "slideNumber": ${slideCount},
      "type": "cta",
      "title": "cta headline",
      "body": "follow for more + what they'll get",
      "emoji": "🎯"
    }
  ],
  "suggestedHashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
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
