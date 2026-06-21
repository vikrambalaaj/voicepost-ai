import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
      .select("id")
      .eq("id", postId)
      .eq("user_id", userId)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // 1. Fetch comments from db
    let { data: comments, error: fetchErr } = await db
      .from("post_comments")
      .select("*")
      .eq("post_id", postId);

    if (fetchErr) throw fetchErr;

    // 2. If empty, automatically seed 3 unique comments to allow engagement drafting testing
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

    return NextResponse.json({ success: true, comments }, { status: 200 });

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
      .select("id")
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

    // 2. Publish reply to LinkedIn if token exists and not mock
    const { data: accounts } = await db
      .from("linkedin_accounts")
      .select("access_token, profile_id")
      .eq("user_id", userId);

    const activeAccount = accounts?.[0];
    let isMock = !activeAccount || activeAccount.access_token.startsWith("mock_");

    if (!isMock && comment.linkedin_comment_urn) {
      try {
        console.log(`[comments] Posting reply to LinkedIn comment ${comment.linkedin_comment_urn}...`);
        const lnRes = await fetch(`https://api.linkedin.com/v2/socialActions/${encodeURIComponent(comment.linkedin_comment_urn)}/comments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeAccount.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            actor: `urn:li:person:${activeAccount.profile_id}`,
            message: {
              text: reply_text
            }
          })
        });

        if (!lnRes.ok) {
          const lnErrText = await lnRes.text();
          console.warn("[comments] Failed to publish reply on LinkedIn:", lnErrText);
        } else {
          console.log("[comments] Reply successfully published to LinkedIn!");
        }
      } catch (lnErr) {
        console.error("[comments] LinkedIn API execution exception:", lnErr);
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
