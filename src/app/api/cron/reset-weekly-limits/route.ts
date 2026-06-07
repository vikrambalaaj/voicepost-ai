import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Called every Monday at 00:00 UTC by Vercel cron (see vercel.json)
// Resets weekly post and image usage counters for all users
export async function GET(req: NextRequest) {
  // Validate cron secret to prevent unauthorized triggering
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceSupabase();

  try {
    const { error } = await db
      .from("users")
      .update({
        posts_used_this_week: 0,
        ai_images_used_this_week: 0,
      })
      .gte("id", "00000000-0000-0000-0000-000000000000"); // Matches all rows

    if (error) throw error;

    console.log("[cron/reset-weekly-limits] Weekly usage counters reset successfully.");
    return NextResponse.json({ success: true, reset_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("[cron/reset-weekly-limits] Failed to reset weekly limits:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
