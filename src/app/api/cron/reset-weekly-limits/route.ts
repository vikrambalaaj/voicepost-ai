import { isCronAuthorized } from "@/lib/admin";
import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Vercel cron (see vercel.json):
//   every Monday 00:00 UTC        -> resets the weekly post and AI-image counters
//   1st of each month (?scope=month) -> resets ONLY the monthly post counter
//     (resetting weekly counters mid-week would hand out a second weekly allowance)
export async function GET(req: NextRequest) {
  // Validate cron secret to prevent unauthorized triggering
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();
  const resetMonth = req.nextUrl.searchParams.get("scope") === "month";

  try {
    const { error } = await db
      .from("users")
      .update(
        resetMonth
          ? { posts_used_this_month: 0 }
          : { posts_used_this_week: 0, ai_images_used_this_week: 0 }
      )
      .gte("id", "00000000-0000-0000-0000-000000000000"); // Matches all rows

    if (error) throw error;

    console.log(`[cron/reset-weekly-limits] ${resetMonth ? "Monthly" : "Weekly"} usage counters reset.`);
    return NextResponse.json({ success: true, scope: resetMonth ? "month" : "week", reset_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[cron/reset-weekly-limits] Failed to reset weekly limits:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
