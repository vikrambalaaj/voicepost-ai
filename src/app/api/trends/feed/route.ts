import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

function getMockTrendsPayload(industry: string, region: string) {
  const ind = (industry || "Technology").toLowerCase();

  if (ind.includes("saas") || ind.includes("tech") || ind.includes("ai") || ind.includes("software") || ind.includes("professional")) {
    return {
      topics: [
        {
          rank: 1,
          topic: "Shift to Multi-Agent Systems in Enterprise AI",
          summary: "Enterprises are moving beyond simple copilots to multi-agent orchestrations that automate complete workflows.",
          suggested_angle: "Focus on standard protocol design and integration layers rather than raw model benchmark scores.",
          momentum: 95,
          source_count: 8,
          sources: [
            "https://news.ycombinator.com/item?id=mock1",
            "https://reddit.com/r/technology/comments/mock1"
          ]
        },
        {
          rank: 2,
          topic: "The Hidden Cost of AI Infrastructure Inefficiency",
          summary: "As organizations scale AI workloads, server utilization and context caching optimization have become critical bottlenecks.",
          suggested_angle: "Explain why model efficiency and local context caching are the true margin savers for engineering teams.",
          momentum: 87,
          source_count: 5,
          sources: [
            "https://techcrunch.com/mock2",
            "https://reddit.com/r/saas/comments/mock2"
          ]
        },
        {
          rank: 3,
          topic: "Developer Platform Engineering Replacing DevOps",
          summary: "Platform engineering teams are focusing on developer portals and internal developer platforms (IDPs) to speed up releases.",
          suggested_angle: "Highlight how reducing developer cognitive load is the single best way to scale shipping speeds.",
          momentum: 82,
          source_count: 4,
          sources: [
            "https://infoq.com/mock3",
            "https://reddit.com/r/programming/comments/mock3"
          ]
        }
      ]
    };
  }

  if (ind.includes("marketing") || ind.includes("brand") || ind.includes("content")) {
    return {
      topics: [
        {
          rank: 1,
          topic: "Organic Zero-Click Content is Outperforming Links",
          summary: "Social algorithms are heavily penalizing posts containing outbound links, forcing brands to publish native content.",
          suggested_angle: "Advocate for complete, self-contained posts in feed text and placing outbound links strictly in comments.",
          momentum: 91,
          source_count: 7,
          sources: [
            "https://marketingbrew.com/mock1",
            "https://reddit.com/r/marketing/comments/mock1"
          ]
        },
        {
          rank: 2,
          topic: "The Rise of Creator-Led Brand Partnerships",
          summary: "Traditional ad conversions are shrinking, driving budget shifts into authentic, micro-influencer product co-development.",
          suggested_angle: "Recommend co-creating raw product reviews instead of paying for scripted talking-point sponsorships.",
          momentum: 84,
          source_count: 5,
          sources: [
            "https://adweek.com/mock2",
            "https://reddit.com/r/socialmedia/comments/mock2"
          ]
        }
      ]
    };
  }

  // General business/professional fallback
  return {
    topics: [
      {
        rank: 1,
        topic: "Asynchronous Work Models Driving Productivity Boosts",
        summary: "Forward-thinking organizations are replacing daily standups with clear, written asynchronous updates.",
        suggested_angle: "Acknowledge that writing replaces meetings, saving up to 8 hours of distraction-filled calendar time weekly.",
        momentum: 89,
        source_count: 6,
        sources: [
          "https://hbr.org/mock1",
          "https://reddit.com/r/business/comments/mock1"
        ]
      },
      {
        rank: 2,
        topic: "The Return-to-Office Pushback and Flex-Work Value",
        summary: "Many employers enforcing hard return-to-office mandates are seeing increased employee attrition.",
        suggested_angle: "Focus on how offering asynchronous flexibility helps retain top performers and reduces hiring friction.",
        momentum: 81,
        source_count: 4,
        sources: [
          "https://forbes.com/mock2",
          "https://reddit.com/r/economics/comments/mock2"
        ]
      }
    ]
  };
}

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user details to get their industry and region
    const { data: user, error: userErr } = await db
      .from("users")
      .select("industry, region")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const industry = (user.industry || "Technology").trim();
    const region = (user.region || "Global").trim();

    // Fetch cached trend row from trending_topics table
    const { data: trends, error: trendsErr } = await db
      .from("trending_topics")
      .select("*")
      .eq("industry", industry)
      .eq("region", region)
      .order("computed_at", { ascending: false })
      .limit(1)
      .single();

    if (trendsErr || !trends) {
      console.log(`[trends] No cached trends found for ${industry} + ${region}. Returning seeded placeholder trends...`);

      const mockPayload = getMockTrendsPayload(industry, region);
      return NextResponse.json({
        success: true,
        trends: mockPayload.topics,
        computed_at: new Date().toISOString(),
        is_mock: true,
        industry,
        region
      });
    }

    return NextResponse.json({
      success: true,
      trends: trends.payload?.topics || [],
      computed_at: trends.computed_at,
      is_mock: false,
      industry,
      region
    });
  } catch (error: any) {
    console.error("[trends/feed] API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
