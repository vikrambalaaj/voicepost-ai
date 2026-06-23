import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";
import { getServiceSupabase } from "@/lib/supabase";
import { triggerBackgroundSync } from "@/lib/comments-sync";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("vp_session")?.value;

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const decoded = verifySessionCookie(session);
  if (!decoded) {
    const res = NextResponse.json({ authenticated: false, reason: "invalid_or_expired" });
    res.cookies.delete("vp_session");
    return res;
  }

  // Trigger non-blocking background sync for likes, comments, and drafts
  triggerBackgroundSync(decoded.userId).catch((err) =>
    console.error("[session] Background sync failed to fire:", err)
  );

  const db = getServiceSupabase();
  const { data: userDb } = await db
    .from("users")
    .select("plan, posts_limit_weekly, posts_limit_monthly, posts_used_this_week, posts_used_this_month")
    .eq("id", decoded.userId)
    .single();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      linkedin_connected: decoded.linkedin_connected,
      plan: userDb?.plan || "free",
      posts_limit_weekly: userDb?.posts_limit_weekly ?? 3,
      posts_limit_monthly: userDb?.posts_limit_monthly ?? 0,
      posts_used_this_week: userDb?.posts_used_this_week ?? 0,
      posts_used_this_month: userDb?.posts_used_this_month ?? 0,
    },
  });
}
