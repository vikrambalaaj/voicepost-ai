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

