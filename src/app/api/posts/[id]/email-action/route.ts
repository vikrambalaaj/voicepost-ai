import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { verifyEmailActionToken } from "@/lib/email-token";
import { sendStatusEmail } from "@/lib/email";

// GET /api/posts/[id]/email-action?token=xxx&action=approve|reject
// No auth required — token is the auth mechanism.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  // ── Validate token ──────────────────────────────────────────────────────────
  if (!token) {
    return redirectToResult(baseUrl, id, "error", "Missing token");
  }

  const verified = verifyEmailActionToken(token);

  if (!verified) {
    return redirectToResult(baseUrl, id, "error", "Link expired or invalid. Please open the approval page directly.");
  }

  if (verified.postId !== id) {
    return redirectToResult(baseUrl, id, "error", "Token mismatch");
  }

  const db = getServiceSupabase();

  // ── Fetch post ───────────────────────────────────────────────────────────────
  const { data: post, error: fetchError } = await db
    .from("posts")
    .select("id, user_id, status, post_content, hashtags")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return redirectToResult(baseUrl, id, "error", "Post not found");
  }

  // Only allow acting on posts that are pending
  if (!["pending_approval", "approved", "draft"].includes(post.status)) {
    return redirectToResult(
      baseUrl,
      id,
      "error",
      `This post has already been ${post.status}. No changes made.`
    );
  }

  // ── Apply action ─────────────────────────────────────────────────────────────
  if (verified.action === "approve") {
    const { error: updateError } = await db
      .from("posts")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return redirectToResult(baseUrl, id, "error", "Failed to approve post");
    }

    // Send confirmation email (non-blocking)
    sendStatusEmail({
      post_id: id,
      action: "approved",
      baseUrl,
    }).catch((e) => console.warn("[email-action] Status email failed:", e));

    return redirectToResult(baseUrl, id, "approved");

  } else {
    // rejected
    const { error: updateError } = await db
      .from("posts")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      return redirectToResult(baseUrl, id, "error", "Failed to reject post");
    }

    // Send notification email (non-blocking)
    sendStatusEmail({
      post_id: id,
      action: "rejected",
      baseUrl,
    }).catch((e) => console.warn("[email-action] Status email failed:", e));

    return redirectToResult(baseUrl, id, "rejected");
  }
}

// Redirect to the nice confirmation page
function redirectToResult(
  baseUrl: string,
  postId: string,
  result: "approved" | "rejected" | "error",
  message?: string
) {
  const url = new URL(`${baseUrl}/posts/${postId}/email-action-result`);
  url.searchParams.set("result", result);
  if (message) url.searchParams.set("msg", message);
  return NextResponse.redirect(url.toString(), { status: 302 });
}
