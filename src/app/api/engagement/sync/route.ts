import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth";
import {
  claimEngagementSync,
  syncUserEngagement,
  ENGAGEMENT_SYNC_MAX_POSTS,
} from "@/lib/comments-sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Refreshes likes, comments and reply drafts for the signed-in user's recent posts.
 * Called by the dashboard on load. Runs at most once per user per 15 minutes; the
 * work is awaited (not fire-and-forget) so serverless does not cut it off.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await claimEngagementSync(userId))) {
    return NextResponse.json({ synced: false, reason: "cooldown" });
  }

  try {
    // Leave headroom under maxDuration (60s) so the response is always sent.
    await syncUserEngagement(userId, undefined, ENGAGEMENT_SYNC_MAX_POSTS, Date.now() + 45_000);
    return NextResponse.json({ synced: true });
  } catch (err: any) {
    console.error("[engagement-sync] failed:", err);
    return NextResponse.json({ synced: false, error: "Engagement sync failed" }, { status: 500 });
  }
}
