import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";
import { routeLLMRequest } from "@/lib/llm/router";

export const dynamic = "force-dynamic";

interface SearchResultItem {
  title: string;
  url: string;
  source: string;
  published_at: string;
  score?: number;
}

// Fetch from Reddit Search (Free, Keyless)
async function fetchReddit(query: string): Promise<SearchResultItem[]> {
  try {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=hot&t=week&limit=25`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (VoicePostAI/1.0)"
      },
      next: { revalidate: 0 }
    });

    if (!res.ok) return [];
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
    console.error("[trends-search] Reddit search failed:", err);
    return [];
  }
}

// Fetch GDELT (Free, Keyless)
async function fetchGdelt(query: string): Promise<SearchResultItem[]> {
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=25`;
    const res = await fetch(url, {
      headers: { "User-Agent": "VoicePostAI/1.0" },
      next: { revalidate: 0 }
    });

    if (!res.ok) return [];
    const data = await res.json();
    const articles = data.articles || [];
    return articles.map((art: any) => ({
      title: art.title || "",
      url: art.url || "",
      source: "GDELT",
      published_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error("[trends-search] GDELT search failed:", err);
    return [];
  }
}

// Fetch Tavily (Using user's API key if available)
async function fetchTavily(query: string, apiKey: string): Promise<SearchResultItem[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: `latest trending discussions on X Twitter and Reddit about ${query}`,
        max_results: 10,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const results = data.results || [];
    return results.map((r: any) => ({
      title: r.title || "",
      url: r.url || "",
      source: "Tavily (Web Search)",
      published_at: new Date().toISOString()
    }));
  } catch (err) {
    console.error("[trends-search] Tavily search failed:", err);
    return [];
  }
}

// Fetch from Hacker News (Free, Keyless API)
async function fetchHackerNews(query?: string): Promise<SearchResultItem[]> {
  try {
    const res = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
      next: { revalidate: 1800 } // cache for 30 mins
    });
    if (!res.ok) return [];
    const storyIds = await res.json();
    
    // Fetch details for top 12 stories
    const sliceIds = storyIds.slice(0, 12);
    const promises = sliceIds.map((id: number) => 
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.json())
        .catch(() => null)
    );
    const stories = await Promise.all(promises);
    
    const items: SearchResultItem[] = [];
    stories.forEach((s) => {
      if (s && s.title && s.url) {
        if (query) {
          const q = query.toLowerCase();
          const t = s.title.toLowerCase();
          if (!t.includes(q)) return;
        }
        items.push({
          title: s.title,
          url: s.url,
          source: "Hacker News",
          published_at: s.time ? new Date(s.time * 1000).toISOString() : new Date().toISOString(),
          score: s.score || 0
        });
      }
    });
    return items;
  } catch (err) {
    console.error("[trends-search] HN search failed:", err);
    return [];
  }
}

// Fetch from V2EX Hot Topics (Free, Keyless API)
async function fetchV2ex(query?: string): Promise<SearchResultItem[]> {
  try {
    const res = await fetch("https://www.v2ex.com/api/topics/hot.json", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      next: { revalidate: 1800 }
    });
    if (!res.ok) return [];
    const topics = await res.json();
    const items: SearchResultItem[] = [];
    topics.forEach((t: any) => {
      if (t && t.title && t.url) {
        if (query) {
          const q = query.toLowerCase();
          const title = t.title.toLowerCase();
          const content = (t.content || "").toLowerCase();
          if (!title.includes(q) && !content.includes(q)) return;
        }
        items.push({
          title: t.title,
          url: t.url,
          source: "V2EX",
          published_at: t.created ? new Date(t.created * 1000).toISOString() : new Date().toISOString(),
          score: t.replies || 0
        });
      }
    });
    return items;
  } catch (err) {
    console.error("[trends-search] V2EX search failed:", err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    // 1. Authenticate User
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic")?.trim() || "";

    if (!topic) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // 2. Fetch User plan
    const { data: user } = await db
      .from("users")
      .select("plan")
      .eq("id", userId)
      .single();

    const plan = user?.plan || "free";

    // 3. Search in parallel
    const tavilyKey = process.env.TAVILY_API_KEY;
    const isTechFeed = topic.toLowerCase() === "hacker news";
    const filterQuery = isTechFeed ? undefined : topic;

    const promises = [
      fetchReddit(topic),
      fetchGdelt(topic),
      fetchHackerNews(filterQuery),
      fetchV2ex(filterQuery),
    ];
    if (tavilyKey) {
      promises.push(fetchTavily(topic, tavilyKey));
    }

    const settled = await Promise.allSettled(promises);
    let rawItems: SearchResultItem[] = [];
    settled.forEach((p) => {
      if (p.status === "fulfilled" && p.value) {
        rawItems = [...rawItems, ...p.value];
      }
    });

    // Deduplicate items by title
    const seenTitles = new Set<string>();
    const filteredItems = rawItems.filter((item) => {
      const cleanTitle = item.title.toLowerCase().trim();
      if (!cleanTitle || seenTitles.has(cleanTitle)) return false;
      seenTitles.add(cleanTitle);
      return true;
    });

    // Fallback: If no real-time items returned (rate-limit / offline), seed mock items
    let searchItems = filteredItems;
    if (searchItems.length < 3) {
      searchItems = [
        {
          title: `Why ${topic} is changing the way companies operate this week`,
          url: "https://reddit.com/r/technology",
          source: "Reddit",
          published_at: new Date().toISOString()
        },
        {
          title: `Latest industry shifts in ${topic} and how professionals are adapting`,
          url: "https://news.google.com",
          source: "GDELT",
          published_at: new Date().toISOString()
        },
        {
          title: `Insights and discussions on ${topic} tools driving productivity boosts`,
          url: "https://reddit.com/r/business",
          source: "Reddit",
          published_at: new Date().toISOString()
        }
      ];
    }

    // 4. Distill using LLM
    const systemPrompt = `You are a trend-analysis engine for a LinkedIn content creation tool.
You will be provided with a raw list of news articles, social discussions, and web search results about the topic "${topic}".
Your job is to analyze them and extract the TOP 5 distinct, hot trending topics that a professional could write a high-engagement LinkedIn post about today.

RULES:
1. DEDUPLICATE: Merge similar stories or discussions into a single topic theme.
2. RANK: Order by relevance and momentum (1 is the hottest).
3. ANGLE: For each topic, provide a highly specific suggested_angle — a contrarian, practical, or practitioner take a professional can write about. Make it actionable and interesting.
4. FACTS: Rely strictly on the input. Do not invent companies, stats, or fake events. If details are not in the input, generalize them or keep it simple.
5. FORMAT: Output ONLY raw JSON matching the following schema. DO NOT include any introductory or concluding text, explanations, or markdown backticks.

OUTPUT SCHEMA:
{
  "topics": [
    {
      "rank": 1,
      "topic": "Title (max 8 words)",
      "summary": "1-2 sentence neutral summary of what is happening",
      "suggested_angle": "One actionable, engaging LinkedIn post angle",
      "momentum": 85,
      "sources": ["url1", "url2"]
    }
  ]
}`;

    const userPrompt = `Here are the raw search results for the topic "${topic}":
${JSON.stringify(searchItems.slice(0, 30), null, 2)}

Return the top 5 deduplicated trending topics as JSON.`;

    const llmRes = await routeLLMRequest({
      useCase: "trend_analysis",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      userId: userId,
      userPlan: plan as any,
      sessionId: `trends-search-${Date.now()}`,
      responseFormat: "json"
    });

    let cleanText = llmRes.content.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    const parsedPayload = JSON.parse(cleanText);

    if (!parsedPayload || !Array.isArray(parsedPayload.topics)) {
      throw new Error("Invalid LLM response structure");
    }

    return NextResponse.json({
      success: true,
      topic,
      trends: parsedPayload.topics.slice(0, 5),
      computed_at: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("[trends-search] API error:", error);
    return NextResponse.json({ error: error.message || "Failed to search trends" }, { status: 500 });
  }
}
