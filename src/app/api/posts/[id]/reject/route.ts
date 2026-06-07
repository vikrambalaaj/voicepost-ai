import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";
import { sendStatusEmail } from "@/lib/email";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

  try {
    const body = await req.json();
    const { feedback } = body;

    const userId = await getAuthenticatedUserId(req);

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: post, error } = await db
      .from("posts")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !post) {
      return NextResponse.json({ error: "Post not found or update failed" }, { status: 404 });
    }

    // Save feedback to current revision if revision exists
    if (feedback) {
      await db
        .from("post_revisions")
        .update({ feedback_given: feedback })
        .eq("post_id", id)
        .eq("revision_number", post.current_revision || 1);
    }

    // Send status email with feedback (non-blocking)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    sendStatusEmail({
      post_id: id,
      action: "rejected",
      feedback,
      baseUrl,
    }).catch((e) => console.warn("[reject] Status email failed:", e));

    return NextResponse.json({ success: true, post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
