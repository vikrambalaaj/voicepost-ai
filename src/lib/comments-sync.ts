import { getServiceSupabase } from "./supabase";
import { routeLLMRequest } from "./llm/router";
import { cleanJsonString } from "./utils";

export const ENGAGEMENT_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
/** Background syncs only look at recent posts so a request stays inside its time limit. */
export const ENGAGEMENT_SYNC_MAX_POSTS = 10;

/**
 * Atomically claims this user's sync slot in the database (shared across serverless
 * instances, unlike an in-memory map). Returns false while the cooldown is running.
 */
export async function claimEngagementSync(userId: string, now = Date.now()): Promise<boolean> {
  const db = getServiceSupabase();
  const cutoff = new Date(now - ENGAGEMENT_SYNC_COOLDOWN_MS).toISOString();
  const { data, error } = await db
    .from("users")
    .update({ last_synced_at: new Date(now).toISOString() })
    .eq("id", userId)
    .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
    .select("id");
  if (error) {
    console.error("[engagement-sync] could not claim sync slot:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * `deadlineAt` (epoch ms) bounds the whole sync: once it is near, remaining posts and
 * reply drafts are skipped so the caller's serverless function is not killed mid-run.
 */
export async function syncUserEngagement(
  userId: string,
  onlyPostId?: string,
  maxPosts?: number,
  deadlineAt?: number
) {
  const msLeft = () => (deadlineAt ? deadlineAt - Date.now() : Number.POSITIVE_INFINITY);
  const db = getServiceSupabase();

  // 1. Get all published posts for this user
  let postsQuery = db
    .from("posts")
    .select("id, linkedin_post_id, linkedin_account_id, post_content, agent_thoughts")
    .eq("user_id", userId)
    .eq("status", "published");
  if (onlyPostId) postsQuery = postsQuery.eq("id", onlyPostId);
  if (maxPosts) {
    postsQuery = postsQuery.order("published_at", { ascending: false, nullsFirst: false }).limit(maxPosts);
  }
  const { data: posts } = await postsQuery;

  if (!posts || posts.length === 0) return;

  // 2. Load primary active account
  const { data: accs } = await db
    .from("linkedin_accounts")
    .select("id, access_token, linkedin_profile_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .limit(1);
  const activeAccount = accs?.[0];

  const isMock = !activeAccount || activeAccount.access_token.startsWith("mock_") || !process.env.LINKEDIN_CLIENT_ID;

  for (const post of posts) {
    if (msLeft() < 5_000) {
      console.warn("[sync] time budget used up; remaining posts sync next time.");
      break;
    }
    try {
      let likesCount = 0;
      let commentsCount = 0;
      let commentsList: any[] = [];

      const isPostMock = isMock || !post.linkedin_post_id || post.linkedin_post_id.startsWith("mock_");

      if (!isPostMock) {
        // Real LinkedIn integration
        try {
          // Fetch Social Actions (Likes/Comments count)
          const saRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedin_post_id)}`, {
            headers: {
              Authorization: `Bearer ${activeAccount.access_token}`,
              "X-Restli-Protocol-Version": "2.0.0",
            },
          });
          if (saRes.ok) {
            const saData = await saRes.json();
            likesCount = saData.likesSummary?.totalLikes ?? 0;
            commentsCount = saData.commentsSummary?.totalComments ?? 0;
          }

          // Fetch comments
          const commentsRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(post.linkedin_post_id)}/comments?count=50`, {
            headers: {
              Authorization: `Bearer ${activeAccount.access_token}`,
              "X-Restli-Protocol-Version": "2.0.0",
            },
          });
          if (commentsRes.ok) {
            const cData = await commentsRes.json();
            commentsList = cData.elements || [];
          }
        } catch (lnErr) {
          console.warn(`[sync] LinkedIn API error for post ${post.id}:`, lnErr);
        }
      } else {
        // Real accounts never get invented commenters: a post without a real LinkedIn id
        // (e.g. copied and pasted by hand) simply has nothing to sync.
        if (!isMock) continue;

        // Demo account only: mock post or mock mode
        // Try loading existing comments from DB
        const { data: dbComments } = await db
          .from("post_comments")
          .select("*")
          .eq("post_id", post.id);

        if (dbComments && dbComments.length > 0) {
          commentsList = dbComments;
        } else {
          // Seed mock comments
          const seedData = [
            {
              post_id: post.id,
              commenter_name: "Sarah Jenkins",
              commenter_headline: "VP of Operations at ScaleUp",
              comment_text: "This is exactly the bottleneck we've been struggling with. How does this strategy handle custom integrations or legacy systems?",
            },
            {
              post_id: post.id,
              commenter_name: "David Chen",
              commenter_headline: "Founder & CTO at CloudNative",
              comment_text: "Spot on! We migrated to the cloud last quarter and cost optimization was our biggest headache. Glad to see some structure here.",
            },
            {
              post_id: post.id,
              commenter_name: "Elena Rostova",
              commenter_headline: "Enterprise Architecture Consultant",
              comment_text: "Excellent write-up. Most organizations underestimate the importance of dedicated support plans during transitions. Do you recommend this for smaller teams?",
            }
          ];
          const { data: seeded } = await db.from("post_comments").insert(seedData).select();
          commentsList = seeded || [];
        }

        // Check if we can find this post in user_posts_raw to get original counts
        if (post.linkedin_post_id) {
          const { data: rawPost } = await db
            .from("user_posts_raw")
            .select("likes_count, comments_count")
            .eq("user_id", userId)
            .eq("linkedin_post_id", post.linkedin_post_id)
            .limit(1)
            .single();
          if (rawPost) {
            likesCount = rawPost.likes_count ?? 15;
            commentsCount = rawPost.comments_count ?? commentsList.length;
          } else {
            likesCount = 15;
            commentsCount = commentsList.length;
          }
        } else {
          likesCount = 15;
          commentsCount = commentsList.length;
        }
      }

      // Save / update comments in DB and generate drafts
      if (commentsList.length > 0) {
        let processed: any[] = [];
        
        if (!isPostMock) {
          // Map and upsert real comments
          processed = await Promise.all(
            commentsList.map(async (comment: any) => {
              let commenter_name = "LinkedIn Member";
              let commenter_headline = "Professional";
              try {
                const actorId = comment.actor.split(":").pop();
                const isOrg = comment.actor.startsWith("urn:li:organization:");
                const url = isOrg
                  ? `https://api.linkedin.com/v2/organizations/${actorId}?projection=(id,localizedName)`
                  : `https://api.linkedin.com/v2/people/${actorId}?projection=(id,localizedFirstName,localizedLastName,localizedHeadline)`;

                const pRes = await fetch(url, {
                  headers: {
                    Authorization: `Bearer ${activeAccount.access_token}`,
                    "X-Restli-Protocol-Version": "2.0.0",
                  },
                });
                if (pRes.ok) {
                  const pData = await pRes.json();
                  if (isOrg) {
                    commenter_name = pData.localizedName || commenter_name;
                  } else {
                    const first = pData.localizedFirstName || "";
                    const last = pData.localizedLastName || "";
                    commenter_name = `${first} ${last}`.trim() || commenter_name;
                    commenter_headline = pData.localizedHeadline || commenter_headline;
                  }
                }
              } catch {}

              const newCommentPayload = {
                post_id: post.id,
                linkedin_comment_urn: comment.id,
                commenter_name,
                commenter_headline,
                comment_text: comment.message?.text || "",
                created_at: new Date(comment.created?.time || Date.now()).toISOString(),
              };

              // Upsert in database
              const { data: existing } = await db
                .from("post_comments")
                .select("id, reply_text, reply_draft")
                .eq("post_id", post.id)
                .eq("linkedin_comment_urn", comment.id)
                .limit(1);

              let dbCommentId;
              let localReplyText = null;
              let localReplyDraft = null;

              if (existing && existing.length > 0) {
                dbCommentId = existing[0].id;
                localReplyText = existing[0].reply_text;
                localReplyDraft = existing[0].reply_draft;
                await db.from("post_comments").update(newCommentPayload).eq("id", dbCommentId);
              } else {
                const { data: inserted } = await db.from("post_comments").insert(newCommentPayload).select("id").single();
                dbCommentId = inserted?.id;
              }

              return {
                id: dbCommentId,
                post_id: post.id,
                linkedin_comment_urn: comment.id,
                commenter_name,
                commenter_headline,
                comment_text: comment.message?.text || "",
                reply_text: localReplyText,
                reply_draft: localReplyDraft,
                created_at: newCommentPayload.created_at,
              };
            })
          );
        } else {
          // Mock comments already exist in DB
          processed = commentsList.map((c: any) => ({
            id: c.id,
            post_id: post.id,
            linkedin_comment_urn: c.linkedin_comment_urn,
            commenter_name: c.commenter_name,
            commenter_headline: c.commenter_headline,
            comment_text: c.comment_text,
            reply_text: c.reply_text,
            reply_draft: c.reply_draft,
            created_at: c.created_at || new Date().toISOString(),
          }));
        }

        // Sort comments by created_at descending (latest first) to show the "last" comments
        processed.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        // Take the top 3 comments (max)
        const last3Comments = processed.slice(0, 3);

        // Pre-generate drafts for the first 2 comments (max 2 comments reply) if they haven't been replied to yet AND don't have drafts yet
        const commentsToDraft = last3Comments.slice(0, 2);
        for (const comm of commentsToDraft) {
          if (msLeft() < 15_000) break; // not enough time left for an LLM call
          const hasReplied = !!comm.reply_text;
          const hasDraft = !!comm.reply_draft;

          if (!hasReplied && !hasDraft) {
            try {
              console.log(`[sync] Generating style-aligned drafts for comment ${comm.id}...`);
              const draftOptions = await generateCommentDrafts({
                userId,
                postContent: post.post_content,
                commentText: comm.comment_text,
                db,
                deadlineAt,
              });

              if (draftOptions && draftOptions.length > 0) {
                const draftStr = JSON.stringify(draftOptions);
                comm.reply_draft = draftStr;

                const payload: any = { reply_draft: draftStr };
                try {
                  const { error: updErr } = await db
                    .from("post_comments")
                    .update(payload)
                    .eq("id", comm.id);
                  if (updErr) throw updErr;
                } catch (updErr) {
                  console.warn(`[sync] Failed to save reply_draft to DB (schema not updated?):`, updErr);
                }
              }
            } catch (draftErr) {
              console.error(`[sync] Draft generation failed for comment ${comm.id}:`, draftErr);
            }
          }
        }
      }

      // Save persistent analytics (likes/comments count) to posts.agent_thoughts
      let currentThoughts = post.agent_thoughts || "";
      let parsedThoughts: any = {};
      try {
        if (currentThoughts.startsWith("{")) {
          parsedThoughts = JSON.parse(currentThoughts);
        } else {
          parsedThoughts = { original_thoughts: currentThoughts };
        }
      } catch {
        parsedThoughts = { original_thoughts: currentThoughts };
      }

      parsedThoughts.likes_count = likesCount;
      parsedThoughts.comments_count = commentsCount;
      parsedThoughts.last_synced_at = new Date().toISOString();

      await db
        .from("posts")
        .update({ agent_thoughts: JSON.stringify(parsedThoughts) })
        .eq("id", post.id);

    } catch (postErr) {
      console.error(`[sync] Error syncing post ${post.id}:`, postErr);
    }
  }
}

async function generateCommentDrafts({
  userId,
  postContent,
  commentText,
  db,
  deadlineAt,
}: {
  userId: string;
  postContent: string;
  commentText: string;
  db: any;
  deadlineAt?: number;
}) {
  const { data: user } = await db.from("users").select("plan").eq("id", userId).single();
  const userPlan = user?.plan || "pro";

  const { data: profile } = await db.from("style_profiles").select("style_json").eq("user_id", userId).single();
  const styleJson = profile?.style_json || {
    tone_descriptor: "authoritative, urgent, professional",
    uses_emojis: false,
    emoji_frequency: "none",
    avoided_corporate_words: ["delve", "leverage", "cutting-edge"]
  };

  const systemPrompt = `You are a professional LinkedIn ghostwriter and engagement strategist.
Draft exactly three distinct, high-impact reply options to a comment thread left on your client's LinkedIn post.

POST CONTEXT:
"${postContent}"

PARENT COMMENT:
"${commentText}"

CLIENT'S WRITING TONE & STYLE (STYLE DNA):
- Tone: ${styleJson.tone_descriptor || "professional"}
- Avoid these corporate words: ${(styleJson.avoided_corporate_words || []).join(", ") || "none"}
- Emoji usage: ${styleJson.uses_emojis ? `Match ${styleJson.emoji_frequency || "low"} frequency` : "Strictly no emojis"}

CRITICAL RULES:
1. Replies must be concise (under 25 words).
2. Avoid any generic AI filler phrases.
3. Every option must be a unique reply style:
   - Option 1: Short & Punchy (validation or simple agreement).
   - Option 2: Value-Add (brief insight that adds onto their comment).
   - Option 3: Question-based (brief follow-up question to keep the comment thread active).
4. Return ONLY a valid raw JSON array containing exactly three strings. Do not wrap in markdown backticks.

OUTPUT SCHEMA EXAMPLE:
["Option 1 text...", "Option 2 text...", "Option 3 text..."]`;

  const llmRes = await routeLLMRequest({
    useCase: "content_generation",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the three comment reply options." }
    ],
    userId: userId,
    userPlan: userPlan as any,
    sessionId: "comment-reply-drafting-" + Date.now(),
    responseFormat: "json",
    deadlineAt,
  });

  try {
    return JSON.parse(cleanJsonString(llmRes.content));
  } catch (e) {
    const match = llmRes.content.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(cleanJsonString(match[0]));
    }
  }
  return null;
}
