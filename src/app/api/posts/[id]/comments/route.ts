import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

// Cache for commenter profile details to avoid redundant API requests during a single fetch execution
const profileCache = new Map<string, { name: string; headline: string }>();

async function fetchActorProfile(actorUrn: string, accessToken: string): Promise<{ name: string; headline: string }> {
  if (profileCache.has(actorUrn)) {
    return profileCache.get(actorUrn)!;
  }

  const actorId = actorUrn.split(":").pop();
  const defaultProfile = actorUrn.includes("organization")
    ? { name: "LinkedIn Page", headline: "Company" }
    : { name: "LinkedIn Member", headline: "Professional" };

  try {
    const isOrg = actorUrn.startsWith("urn:li:organization:");
    const url = isOrg
      ? `https://api.linkedin.com/v2/organizations/${actorId}?projection=(id,localizedName)`
      : `https://api.linkedin.com/v2/people/${actorId}?projection=(id,localizedFirstName,localizedLastName,localizedHeadline)`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (res.ok) {
      const data = await res.json();
      let name = defaultProfile.name;
      let headline = defaultProfile.headline;

      if (isOrg) {
        name = data.localizedName || name;
      } else {
        const first = data.localizedFirstName || "";
        const last = data.localizedLastName || "";
        const combined = `${first} ${last}`.trim();
        name = combined || name;
        headline = data.localizedHeadline || headline;
      }

      const result = { name, headline };
      profileCache.set(actorUrn, result);
      return result;
    }
  } catch (err) {
    console.warn(`[comments] Failed to fetch actor profile details for ${actorUrn}:`, err);
  }

  return defaultProfile;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase();
  const postId = params.id;

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify post ownership and select linkedin post/account IDs
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("id, linkedin_post_id, linkedin_account_id")
      .eq("id", postId)
      .eq("user_id", userId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // Load active account credentials
    let activeAccount = null;
    if (post.linkedin_account_id) {
      const { data: acc } = await db
        .from("linkedin_accounts")
        .select("access_token, linkedin_profile_id")
        .eq("id", post.linkedin_account_id)
        .eq("user_id", userId)
        .single();
      activeAccount = acc;
    }
    if (!activeAccount) {
      const { data: accs } = await db
        .from("linkedin_accounts")
        .select("access_token, linkedin_profile_id")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .limit(1);
      activeAccount = accs?.[0];
    }

    const isMock = !activeAccount || activeAccount.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

    // Clear local memory cache per request
    profileCache.clear();

    // 1. If not mock and has linkedin_post_id, fetch from LinkedIn
    if (!isMock && post.linkedin_post_id) {
      try {
        console.log(`[comments] Fetching real comments from LinkedIn for post ${post.linkedin_post_id}...`);
        const lnRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedin_post_id)}/comments?count=50`, {
          headers: {
            Authorization: `Bearer ${activeAccount.access_token}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });

        if (lnRes.ok) {
          const lnData = await lnRes.json();
          const elements = lnData.elements || [];

          const processedComments = await Promise.all(
            elements.map(async (comment: any) => {
              const commenterProfile = await fetchActorProfile(comment.actor, activeAccount.access_token);
              
              // Fetch nested replies for this comment
              let replies: any[] = [];
              try {
                const repRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(comment.id)}/comments?count=50`, {
                  headers: {
                    Authorization: `Bearer ${activeAccount.access_token}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                  },
                });
                if (repRes.ok) {
                  const repData = await repRes.json();
                  const repElements = repData.elements || [];
                  replies = await Promise.all(
                    repElements.map(async (rep: any) => {
                      const repProfile = await fetchActorProfile(rep.actor, activeAccount.access_token);
                      return {
                        commenter_name: repProfile.name,
                        commenter_headline: repProfile.headline,
                        comment_text: rep.message.text,
                        created_at: new Date(rep.created?.time || Date.now()).toISOString(),
                        actor: rep.actor,
                      };
                    })
                  );
                  // Sort replies oldest first
                  replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                }
              } catch (repErr) {
                console.warn(`[comments] Failed to fetch replies for comment ${comment.id}:`, repErr);
              }

              const newCommentPayload = {
                post_id: postId,
                linkedin_comment_urn: comment.id,
                commenter_name: commenterProfile.name,
                commenter_headline: commenterProfile.headline,
                comment_text: comment.message?.text || "",
                created_at: new Date(comment.created?.time || Date.now()).toISOString(),
              };

              // Upsert the top-level comment to Postgres to keep it tracked
              const { data: existing } = await db
                .from("post_comments")
                .select("id, reply_text, replied_at")
                .eq("post_id", postId)
                .eq("linkedin_comment_urn", comment.id)
                .limit(1);

              let dbCommentId;
              let localReplyText = null;

              if (existing && existing.length > 0) {
                dbCommentId = existing[0].id;
                localReplyText = existing[0].reply_text;
                await db
                  .from("post_comments")
                  .update(newCommentPayload)
                  .eq("id", dbCommentId);
              } else {
                const { data: inserted } = await db
                  .from("post_comments")
                  .insert(newCommentPayload)
                  .select("id")
                  .single();
                dbCommentId = inserted?.id;
              }

              return {
                id: dbCommentId,
                post_id: postId,
                linkedin_comment_urn: comment.id,
                commenter_name: commenterProfile.name,
                commenter_headline: commenterProfile.headline,
                comment_text: comment.message?.text || "",
                reply_text: localReplyText,
                thread_history: replies,
                created_at: newCommentPayload.created_at,
              };
            })
          );

          return NextResponse.json({ success: true, comments: processedComments }, { status: 200 });
        } else {
          const errText = await lnRes.text();
          console.warn("[comments] LinkedIn SocialActions returned non-ok status:", lnRes.status, errText);
        }
      } catch (lnErr) {
        console.error("[comments] Exception fetching comments from LinkedIn:", lnErr);
      }
    }

    // 2. Fetch comments from db (fallback / mock seeding)
    let { data: comments, error: fetchErr } = await db
      .from("post_comments")
      .select("*")
      .eq("post_id", postId);

    if (fetchErr) throw fetchErr;

    // If empty, automatically seed 3 unique comments to allow engagement drafting testing
    if (!comments || comments.length === 0) {
      console.log(`[comments] No comments found for post ${postId}. Seeding mock comments...`);
      const mockComments = [
        {
          post_id: postId,
          commenter_name: "Sarah Jenkins",
          commenter_headline: "VP of Operations at ScaleUp",
          comment_text: "This is exactly the bottleneck we've been struggling with. How does this strategy handle custom integrations or legacy systems?",
        },
        {
          post_id: postId,
          commenter_name: "David Chen",
          commenter_headline: "Founder & CTO at CloudNative",
          comment_text: "Spot on! We migrated to the cloud last quarter and cost optimization was our biggest headache. Glad to see some structure here.",
        },
        {
          post_id: postId,
          commenter_name: "Elena Rostova",
          commenter_headline: "Enterprise Architecture Consultant",
          comment_text: "Excellent write-up. Most organizations underestimate the importance of dedicated support plans during transitions. Do you recommend this for smaller teams?",
        }
      ];

      const { data: inserted, error: insertErr } = await db
        .from("post_comments")
        .insert(mockComments)
        .select();

      if (insertErr) {
        console.error("[comments] Failed to seed mock comments:", insertErr);
      } else {
        comments = inserted || [];
      }
    }

    return NextResponse.json({ success: true, comments: comments || [] }, { status: 200 });

  } catch (error: any) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase();
  const postId = params.id;

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify post ownership
    const { data: post, error: postErr } = await db
      .from("posts")
      .select("id, linkedin_account_id")
      .eq("id", postId)
      .eq("user_id", userId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    const body = await req.json();
    const { comment_id, reply_text } = body;

    if (!comment_id || !reply_text) {
      return NextResponse.json({ error: "comment_id and reply_text are required" }, { status: 400 });
    }

    // 1. Fetch the comment details from DB
    const { data: comment, error: commentErr } = await db
      .from("post_comments")
      .select("*")
      .eq("id", comment_id)
      .single();

    if (commentErr || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    // 2. Load connected LinkedIn account
    let activeAccount = null;
    if (post.linkedin_account_id) {
      const { data: acc } = await db
        .from("linkedin_accounts")
        .select("access_token, linkedin_profile_id, profile_name, profile_headline")
        .eq("id", post.linkedin_account_id)
        .eq("user_id", userId)
        .single();
      activeAccount = acc;
    }
    if (!activeAccount) {
      const { data: accs } = await db
        .from("linkedin_accounts")
        .select("access_token, linkedin_profile_id, profile_name, profile_headline")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .limit(1);
      activeAccount = accs?.[0];
    }

    const isMock = !activeAccount || activeAccount.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

    if (!isMock && comment.linkedin_comment_urn) {
      try {
        console.log(`[comments] Posting reply to LinkedIn comment ${comment.linkedin_comment_urn}...`);
        const lnRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(comment.linkedin_comment_urn)}/comments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeAccount.access_token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
          },
          body: JSON.stringify({
            actor: activeAccount.linkedin_profile_id,
            message: {
              text: reply_text
            }
          })
        });

        if (!lnRes.ok) {
          const lnErrText = await lnRes.text();
          console.warn("[comments] Failed to publish reply on LinkedIn:", lnErrText);
          return NextResponse.json({ error: `LinkedIn API error: ${lnErrText}` }, { status: 400 });
        } else {
          console.log("[comments] Reply successfully published to LinkedIn!");
        }
      } catch (lnErr: any) {
        console.error("[comments] LinkedIn API execution exception:", lnErr);
        return NextResponse.json({ error: `LinkedIn connection error: ${lnErr.message}` }, { status: 500 });
      }
    } else {
      console.log(`[comments] (Mock Mode) Reply simulated successfully: "${reply_text}"`);
    }

    // 3. Update DB state
    const { data: updatedComment, error: updateErr } = await db
      .from("post_comments")
      .update({
        reply_text,
        replied_at: new Date().toISOString()
      })
      .eq("id", comment_id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, comment: updatedComment }, { status: 200 });

  } catch (error: any) {
    console.error("Failed to post comment reply:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
