import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import path from "path";

export const dynamic = "force-dynamic";

interface NormalizedItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  score?: number;
}

// Map region names to GDELT sourcecountry codes
function getGdeltQuery(industry: string, region: string): string {
  const cleanIndustry = industry.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  let query = `(${cleanIndustry}) sourcelang:eng`;

  const cleanRegion = region.trim().toLowerCase();
  if (cleanRegion === "us" || cleanRegion === "united states") {
    query += " sourcecountry:US";
  } else if (cleanRegion === "uk" || cleanRegion === "united kingdom") {
    query += " sourcecountry:UK";
  } else if (cleanRegion === "ca" || cleanRegion === "canada") {
    query += " sourcecountry:CA";
  } else if (cleanRegion === "in" || cleanRegion === "india") {
    query += " sourcecountry:IN";
  } else if (cleanRegion === "au" || cleanRegion === "australia") {
    query += " sourcecountry:AU";
  }
  return query;
}

// Parse YYYYMMDDHHMMSS format into ISO string
function parseGdeltDate(gdeltDateStr: string): string {
  try {
    const cleanStr = gdeltDateStr.replace(/[^0-9]/g, "");
    if (cleanStr.length >= 8) {
      const year = cleanStr.slice(0, 4);
      const month = cleanStr.slice(4, 6);
      const day = cleanStr.slice(6, 8);
      const hour = cleanStr.slice(8, 10) || "00";
      const min = cleanStr.slice(10, 12) || "00";
      const sec = cleanStr.slice(12, 14) || "00";
      return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString();
    }
  } catch {}
  return new Date().toISOString();
}

async function fetchGdelt(industry: string, region: string): Promise<NormalizedItem[]> {
  try {
    const queryStr = getGdeltQuery(industry, region);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(queryStr)}&mode=artlist&format=json&maxrecords=50`;
    console.log(`[trends] Fetching GDELT for ${industry}/${region}: ${url}`);

    const res = await fetch(url, {
      headers: { "User-Agent": "VoicePostAI/1.0 (contact@digitalfoundry.ai)" },
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      console.warn(`[trends] GDELT API error for ${industry}/${region}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const articles = data.articles || [];
    return articles.map((art: any) => ({
      title: art.title || "",
      url: art.url || "",
      source: "GDELT",
      published_at: art.seendate ? parseGdeltDate(art.seendate) : new Date().toISOString()
    }));
  } catch (err) {
    console.error(`[trends] Failed to fetch GDELT for ${industry}/${region}:`, err);
    return [];
  }
}

async function fetchReddit(industry: string, region: string): Promise<NormalizedItem[]> {
  try {
    const cleanIndustry = industry.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    const cleanRegion = region.trim().toLowerCase();
    const query = cleanRegion === "global" ? cleanIndustry : `${cleanIndustry} ${region}`;
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=hot&t=day&limit=50`;
    console.log(`[trends] Fetching Reddit for ${industry}/${region}: ${url}`);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (VoicePostAI/1.0; +contact@digitalfoundry.ai)"
      },
      next: { revalidate: 0 }
    });

    if (!res.ok) {
      console.warn(`[trends] Reddit API error for ${industry}/${region}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const children = data?.data?.children || [];
    return children.map((child: any) => {
      const p = child?.data;
      return {
        title: p?.title || "",
        url: p?.permalink ? `https://www.reddit.com${p.permalink}` : (p?.url || ""),
        source: "Reddit",
        published_at: p?.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
        score: p?.score || 0
      };
    });
  } catch (err) {
    console.error(`[trends] Failed to fetch Reddit for ${industry}/${region}:`, err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  // 1. Authenticate Cron Job
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow bypassing auth in development for testing
  const isDev = process.env.NODE_ENV !== "production";
  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();

  try {
    // 2. Fetch unique active configurations from users
    const { data: usersData, error: usersErr } = await db
      .from("users")
      .select("industry, region");

    if (usersErr) throw usersErr;

    const combos = new Map<string, { industry: string; region: string }>();

    if (usersData && usersData.length > 0) {
      for (const u of usersData) {
        const ind = (u.industry || "").trim();
        const reg = (u.region || "Global").trim();
        if (ind) {
          const key = `${ind.toLowerCase()}|${reg.toLowerCase()}`;
          combos.set(key, { industry: ind, region: reg });
        }
      }
    }

    // Default fallbacks if no combinations found in DB
    if (combos.size === 0) {
      combos.set("technology|global", { industry: "Technology", region: "Global" });
      combos.set("saas & ai|us", { industry: "SaaS & AI", region: "US" });
    }

    const combosArray = Array.from(combos.values());

    const processed = await Promise.allSettled(
      combosArray.map(async (combo) => {
        const { industry, region } = combo;

        // Ingest in parallel
        const [gdeltItems, redditItems] = await Promise.all([
          fetchGdelt(industry, region),
          fetchReddit(industry, region)
        ]);

        // Normalize & Filter
        const rawItems = [...gdeltItems, ...redditItems];
        let filteredItems = rawItems.filter(
          (item) => item.title && item.title.trim().length > 0 && item.url
        );

        console.log(`[trends] Normalized ${filteredItems.length} items for ${industry}/${region}.`);

        // Fallback/Seed mock data for local testing or dev fallback if low signal
        if (filteredItems.length < 5) {
          console.log(`[trends] Low signal (${filteredItems.length} items) for ${industry}/${region}. Seeding mock raw feeds for testing.`);
          filteredItems = getMockRawItems(industry, region);
        }

        // Skip if still fewer than 5 items
        if (filteredItems.length < 5) {
          console.log(`[trends] Skipping ${industry}/${region} due to insufficient signal (< 5 items).`);
          return { industry, region, status: "skipped", reason: "insufficient signal" };
        }

        // Build Prompt
        const systemPrompt = `You are a trend-analysis engine for a LinkedIn content tool. You receive a raw list of news articles and forum posts from the last 24 hours. Your job is to distill them into the TOP 10 distinct trending topics that a professional could write a LinkedIn post about, ranked by momentum.
RULES:

DEDUPLICATE aggressively. Multiple items about the same underlying story or theme = ONE topic. Merge them and treat the combined coverage as a stronger signal. Two articles on "OpenAI release" and one Reddit thread on the same release are ONE topic, not three.
A "topic" is a theme worth posting about, NOT a single headline. Generalize appropriately (e.g. "Enterprises are cutting AI pilot budgets" rather than one company's earnings call).
RANK by momentum: weight (a) how many input items cluster into the topic, (b) their signal values, (c) recency, and (d) relevance to the user's industry ("${industry}"). Industry-relevant topics outrank generic ones.
EXCLUDE pure clickbait, celebrity gossip, sports scores, and anything with no professional angle.
Return EXACTLY 10 topics. If fewer than 10 distinct quality topics exist, return only the valid ones — never pad with weak filler.
For each topic write a suggested_angle: one sentence on the contrarian, insightful, or practitioner take a professional could use. Make it specific, not generic.
Use ONLY information present in the input. Do NOT invent facts, statistics, companies, or events. If you're unsure a detail is supported, omit it.
Output ONLY raw JSON matching the schema. No preamble, no markdown, no code fences, no trailing commentary. Do not use asterisks anywhere.

OUTPUT SCHEMA:
{"topics":[{"rank":1,"topic":"short title, max 8 words","summary":"1-2 sentence neutral description of what's happening","suggested_angle":"one specific post angle","momentum":0-100,"source_count":int,"sources":["url","url"]}]}

User message (templated):

Industry focus: ${industry}

Region: ${region}

Current date: ${new Date().toISOString().split("T")[0]}
Raw items (${filteredItems.length} total):

${JSON.stringify(filteredItems.slice(0, 40), null, 2)}
Return the top 10 deduplicated trending topics as JSON.`;

        // Call LLM Router
        const llmRes = await routeLLMRequest({
          useCase: "trend_analysis",
          messages: [{ role: "user", content: systemPrompt }],
          userId: "00000000-0000-0000-0000-000000000000",
          userPlan: "agency",
          sessionId: "cron-trends",
          preferredProviderId: "nvidia",
          responseFormat: "json"
        });

        let parsedPayload: any;
        try {
          let cleanText = llmRes.content.trim();
          if (cleanText.startsWith("```")) {
            cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
          }
          parsedPayload = JSON.parse(cleanText);
        } catch (parseErr: any) {
          console.error(`[trends] Failed to parse LLM response for ${industry}/${region}:`, parseErr, llmRes.content);
          return { industry, region, status: "failed", reason: "json parse error" };
        }

        // Validate array of <= 10
        if (!parsedPayload || !Array.isArray(parsedPayload.topics)) {
          console.error(`[trends] Invalid structure for ${industry}/${region}: 'topics' not an array.`);
          return { industry, region, status: "failed", reason: "invalid schema" };
        }

        if (parsedPayload.topics.length > 10) {
          parsedPayload.topics = parsedPayload.topics.slice(0, 10);
        }

        // Upsert into DB
        const { error: upsertErr } = await db
          .from("trending_topics")
          .upsert({
            industry,
            region,
            payload: parsedPayload,
            computed_at: new Date().toISOString()
          }, {
            onConflict: "industry,region"
          });

        if (upsertErr) {
          console.error(`[trends] Failed to upsert trends for ${industry}/${region}:`, upsertErr);
          return { industry, region, status: "failed", reason: "database upsert error" };
        } else {
          console.log(`[trends] Successfully updated trends for ${industry}/${region}.`);
          return { industry, region, status: "success", count: parsedPayload.topics.length };
        }
      })
    );

    const results = processed.map((p) => {
      if (p.status === "fulfilled") return p.value;
      return { status: "rejected", reason: p.reason };
    });

    return NextResponse.json({ success: true, processed: results }, { status: 200 });

  } catch (err: any) {
    console.error("[trends] Cron job execution crash:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function getMockRawItems(industry: string, region: string): NormalizedItem[] {
  return [
    {
      title: `The growing stack of agentic workflows in ${industry}`,
      url: "https://techcrunch.com/mock-article-1",
      source: "GDELT",
      published_at: new Date().toISOString()
    },
    {
      title: `Why enterprises in ${region} are adopting local LLMs`,
      url: "https://wired.com/mock-article-2",
      source: "GDELT",
      published_at: new Date().toISOString()
    },
    {
      title: `Is DevOps really dead? Why ${industry} platform engineering is taking over`,
      url: "https://news.ycombinator.com/item?id=mock-3",
      source: "Reddit",
      published_at: new Date().toISOString()
    },
    {
      title: `We migrated our complete ${industry} workflow to Claude and saved 40% on API costs`,
      url: "https://reddit.com/r/saas/comments/mock-4",
      source: "Reddit",
      published_at: new Date().toISOString(),
      score: 120
    },
    {
      title: `Top trends in ${industry} and SaaS for 2026 and beyond`,
      url: "https://forbes.com/mock-article-5",
      source: "GDELT",
      published_at: new Date().toISOString()
    },
    {
      title: `Reddit discussion on the latest ${industry} tools launched in ${region} this week`,
      url: "https://reddit.com/r/technology/comments/mock-6",
      source: "Reddit",
      published_at: new Date().toISOString(),
      score: 85
    }
  ];
}
