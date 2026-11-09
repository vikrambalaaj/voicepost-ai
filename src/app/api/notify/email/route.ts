import { NextRequest, NextResponse } from "next/server";
import { sendApprovalEmailInternal } from "@/lib/email";
import { getAuthenticatedUserId } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { post_id, post_content, hashtags = [] } = body;

    if (!post_id || !post_content) {
      return NextResponse.json({ error: "post_id and post_content are required" }, { status: 400 });
    }

    // The caller must own the post: otherwise this endpoint is a phishing relay to other users.
    const { data: owned } = await getServiceSupabase()
      .from("posts")
      .select("id")
      .eq("id", post_id)
      .eq("user_id", userId)
      .single();
    if (!owned) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    const safeHashtags = (Array.isArray(hashtags) ? hashtags : []).slice(0, 30).map((h: unknown) => String(h).slice(0, 60));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const result = await sendApprovalEmailInternal({
      post_id,
      post_content: String(post_content).slice(0, 10000),
      hashtags: safeHashtags,
      baseUrl,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[notify/email] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
