import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";
import { sendApprovalEmailInternal } from "@/lib/email";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Auto-sync raw scraped posts to the posts table as published posts
  try {
    const { data: rawPosts } = await db
      .from("user_posts_raw")
      .select("*")
      .eq("user_id", userId)
      .order("published_at", { ascending: false })
      .limit(5);

    if (rawPosts && rawPosts.length > 0) {
      for (const rp of rawPosts) {
        const { data: existing } = await db
          .from("posts")
          .select("id")
          .eq("user_id", userId)
          .eq("linkedin_post_id", rp.linkedin_post_id)
          .limit(1);

        if (!existing || existing.length === 0) {
          const postUrl = rp.linkedin_post_id.startsWith("mock_")
            ? `https://www.linkedin.com/feed/update/${rp.linkedin_post_id}`
            : `https://www.linkedin.com/feed/update/${rp.linkedin_post_id}`;

          await db.from("posts").insert({
            user_id: userId,
            linkedin_account_id: rp.linkedin_account_id,
            post_content: rp.content,
            status: "published",
            published_at: rp.published_at,
            linkedin_post_id: rp.linkedin_post_id,
            linkedin_post_url: postUrl,
          });
        }
      }
    }
  } catch (syncErr) {
    console.warn("[posts/route] Scraped posts backfill failed:", syncErr);
  }

  const { data: posts, error } = await db
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, posts }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { post_content, hashtags, style_type, style_id, status } = body;

    const targetStatus = status || "draft";

    const { data: newPost, error } = await db
      .from("posts")
      .insert({
        user_id: userId,
        post_content: post_content || "",
        hashtags: hashtags || [],
        style_type: style_type || "expert",
        style_id: style_id || "lara_acosta",
        status: targetStatus,
      })
      .select()
      .single();

    if (error) throw error;

    if (newPost && newPost.status === "pending_approval") {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
        await sendApprovalEmailInternal({
          post_id: newPost.id,
          post_content: newPost.post_content,
          hashtags: newPost.hashtags || [],
          baseUrl,
        });
      } catch (emailErr) {
        console.warn("[posts/route] Email notification failed (non-blocking):", emailErr);
      }
    }

    return NextResponse.json({ success: true, post: newPost }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

