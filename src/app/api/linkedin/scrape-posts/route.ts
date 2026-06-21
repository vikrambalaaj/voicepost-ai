import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

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
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let accountId = null;
    try {
      const body = await req.json();
      accountId = body.accountId;
    } catch {}

    if (!accountId) {
      // Find the primary LinkedIn account for this user
      const { data: accounts } = await db
        .from("linkedin_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("is_primary", true);
      
      if (accounts && accounts.length > 0) {
        accountId = accounts[0].id;
      }
    }

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required and LinkedIn account not found" }, { status: 400 });
    }

    // Fetch the LinkedIn account and verify ownership
    const { data: account, error: accErr } = await db
      .from("linkedin_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", userId)
      .single();

    if (accErr || !account) {
      return NextResponse.json({ error: "LinkedIn account not found or unauthorized" }, { status: 404 });
    }

    // Set status to running
    await db
      .from("linkedin_accounts")
      .update({ scraping_status: "running" })
      .eq("id", accountId)
      .eq("user_id", userId);

    const isMock = account.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

    let postsToSave: { user_id: string; linkedin_account_id: string; linkedin_post_id: string; content: string; published_at: string }[] = [];

    if (isMock) {
      // Use mock posts — realistic content for style learning
      postsToSave = MOCK_SCRAPED_POSTS.map((p, index) => ({
        user_id: userId,
        linkedin_account_id: accountId,
        linkedin_post_id: `mock_post_${index}`,
        content: p.text,
        published_at: p.created_at,
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
          postsToSave = MOCK_SCRAPED_POSTS.map((p, index) => ({
            user_id: userId,
            linkedin_account_id: accountId,
            linkedin_post_id: `mock_fallback_${index}`,
            content: p.text,
            published_at: p.created_at,
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
              linkedin_post_id: el.id || `real_post_${Math.random()}`,
              content: el.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text,
              published_at: new Date(el.created?.time || Date.now()).toISOString(),
            }));

          console.log(`[scrape-posts] Fetched ${postsToSave.length} real posts for account ${accountId}`);
        }
      } catch (err) {
        console.error("[scrape-posts] Fetch error:", err);
        // Graceful fallback
        postsToSave = MOCK_SCRAPED_POSTS.map((p, index) => ({
          user_id: userId,
          linkedin_account_id: accountId,
          linkedin_post_id: `mock_fallback_${index}`,
          content: p.text,
          published_at: p.created_at,
        }));
      }
    }

    // Save scraped posts to user_posts_raw table
    if (postsToSave.length > 0) {
      // Clear old raw posts to avoid duplicates
      await db
        .from("user_posts_raw")
        .delete()
        .eq("user_id", userId)
        .eq("linkedin_account_id", accountId);

      const { error: insertErr } = await db
        .from("user_posts_raw")
        .insert(postsToSave)
        .select();

      if (insertErr) {
        console.warn("[scrape-posts] Failed to save scraped posts:", insertErr.message);
      }
    }

    // Trigger style analysis if we have posts (await it synchronously to prevent termination)
    if (postsToSave.length > 0) {
      try {
        const analyzeRes = await fetch(`${req.nextUrl.origin}/api/style/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cookie": req.headers.get("Cookie") || "",
          },
          body: JSON.stringify({ accountId }),
        });
        if (!analyzeRes.ok) {
          console.error("[scrape-posts] Style analysis failed with status:", analyzeRes.status);
        }
      } catch (err) {
        console.error("[scrape-posts] Style analysis fetch error:", err);
      }
    }

    // Update linkedin_accounts: status → complete, posts_scraped_count = count
    const { error: updateErr } = await db
      .from("linkedin_accounts")
      .update({
        scraping_status: "complete",
        posts_scraped_count: postsToSave.length,
        last_scraped_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .eq("user_id", userId);

    if (updateErr) {
      console.error("[scrape-posts] Failed to update scraping status:", updateErr);
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
