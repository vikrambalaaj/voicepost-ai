import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Realistic mock posts to use when LinkedIn credentials aren't configured
const MOCK_SCRAPED_POSTS = [
  {
    text: "Just shipped a feature our users have been asking for months.\n\nThe secret? We stopped building what we thought they wanted.\n\nWe sat in 12 customer calls in 3 weeks. Listened more than we talked.\n\nTurns out the problem was 3 layers deeper than we assumed.\n\nShip fast. But listen faster.\n\nWhat's a feature that surprised you when users finally explained what they actually needed?",
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    text: "Year 1 of building in public: what I learned.\n\n→ Sharing failures got 10× more engagement than wins\n→ Consistency matters more than virality\n→ DMs from strangers became our best customers\n→ Your audience is your co-founder\n\nI used to think vulnerability was weakness.\n\nNow I know it's the best growth strategy I've found.\n\n#buildinpublic #startuplife #saas",
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    text: "Hot take: most AI tools are solving problems nobody has.\n\nThe best ones I've used?\n\nThey solve something embarrassingly simple — but they do it 10× faster.\n\nWe don't need AI that thinks for us.\n\nWe need AI that removes the friction between an idea and execution.\n\nThat's the real moat.\n\nAgree or disagree?",
    created_at: new Date(Date.now() - 9 * 24 * 3600 * 1000).toISOString(),
  },
  {
    text: "Our churn hit 0% last month.\n\nNot because our product is perfect.\n\nBecause we email every user who hasn't logged in for 7 days — personally.\n\nNot a drip. Not automation.\n\nA real email. From me.\n\n'Hey, what happened? Genuinely curious.'\n\nHalf of them come back. Half give us the most valuable feedback we've ever gotten.\n\nRelationships > funnels.",
    created_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
  },
  {
    text: "3 things I wish someone told me before my first B2B sales call:\n\n1. Shut up after you ask a question. Silence is powerful.\n2. The goal isn't to close — it's to understand if you can actually help.\n3. 'No' today is just 'not yet' if you stay in touch.\n\nI lost my first 20 deals because I talked too much.\n\nI've won the last 8 because I listen.\n\nWhat changed your approach to sales?",
    created_at: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
  },
];

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { userId, accountId } = body;

    if (!userId || !accountId) {
      return NextResponse.json({ error: "userId and accountId are required" }, { status: 400 });
    }

    // Fetch the LinkedIn account
    const { data: account, error: accErr } = await db
      .from("linkedin_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "LinkedIn account not found" }, { status: 404 });
    }

    const isMock = account.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

    let postsToSave: { user_id: string; linkedin_account_id: string; post_text: string; posted_at: string; source: string }[] = [];

    if (isMock) {
      // Use mock posts — realistic content for style learning
      postsToSave = MOCK_SCRAPED_POSTS.map((p) => ({
        user_id: userId,
        linkedin_account_id: accountId,
        post_text: p.text,
        posted_at: p.created_at,
        source: "mock",
      }));
      console.log(`[scrape-posts] Using mock posts for account ${accountId}`);
    } else {
      // Real LinkedIn UGC Posts API
      // Requires r_member_social scope (LinkedIn Partner Program) OR w_member_social for own posts
      try {
        const profileId = account.linkedin_profile_id; // e.g. "urn:li:person:ABC123"
        const encodedAuthor = encodeURIComponent(`List(${profileId})`);

        const ugcRes = await fetch(
          `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=${encodedAuthor}&count=5&sortBy=LAST_MODIFIED`,
          {
            headers: {
              Authorization: `Bearer ${account.access_token}`,
              "X-Restli-Protocol-Version": "2.0.0",
            },
          }
        );

        if (!ugcRes.ok) {
          const errText = await ugcRes.text();
          console.warn(`[scrape-posts] LinkedIn API error ${ugcRes.status}: ${errText}. Falling back to mock posts.`);
          // Fall back to mock posts if API not permitted (e.g., scope not approved)
          postsToSave = MOCK_SCRAPED_POSTS.map((p) => ({
            user_id: userId,
            linkedin_account_id: accountId,
            post_text: p.text,
            posted_at: p.created_at,
            source: "mock_fallback",
          }));
        } else {
          const ugcData = await ugcRes.json();
          const elements = ugcData.elements || [];

          postsToSave = elements
            .filter((el: any) => el.specificContent?.["com.linkedin.ugc.ShareContent"]?.shareCommentary?.text)
            .slice(0, 5)
            .map((el: any) => ({
              user_id: userId,
              linkedin_account_id: accountId,
              post_text: el.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text,
              posted_at: new Date(el.created?.time || Date.now()).toISOString(),
              source: "linkedin_api",
            }));

          console.log(`[scrape-posts] Fetched ${postsToSave.length} real posts for account ${accountId}`);
        }
      } catch (err) {
        console.error("[scrape-posts] Fetch error:", err);
        // Graceful fallback
        postsToSave = MOCK_SCRAPED_POSTS.map((p) => ({
          user_id: userId,
          linkedin_account_id: accountId,
          post_text: p.text,
          posted_at: p.created_at,
          source: "mock_fallback",
        }));
      }
    }

    // Save scraped posts to scraped_posts table
    // Use upsert to avoid duplicates on re-scrape
    if (postsToSave.length > 0) {
      const { error: insertErr } = await db
        .from("scraped_posts")
        .upsert(postsToSave, { onConflict: "user_id,post_text" })
        .select();

      if (insertErr) {
        console.warn("[scrape-posts] Failed to save scraped posts:", insertErr.message);
        // Don't fail — just update counts below
      }
    }

    // Update linkedin_accounts: status → ready, posts_scraped_count = count
    await db
      .from("linkedin_accounts")
      .update({
        scraping_status: "ready",
        posts_scraped_count: postsToSave.length,
        last_scraped_at: new Date().toISOString(),
      })
      .eq("id", accountId);

    // Trigger style analysis if we have posts
    if (postsToSave.length > 0) {
      try {
        fetch(`${req.nextUrl.origin}/api/linkedin/analyze-style`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, accountId }),
        }).catch(() => {});
      } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      posts_scraped: postsToSave.length,
      source: isMock ? "mock" : "linkedin_api",
    });
  } catch (error: any) {
    console.error("[scrape-posts] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
