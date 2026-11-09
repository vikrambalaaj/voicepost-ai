import { NextResponse } from "next/server";
import { getServiceSupabase } from "./supabase";

// LLM calls per rolling hour (each generate/regenerate makes several calls, so these are generous).
const HOURLY_LLM_CALLS: Record<string, number> = {
  free: 40,
  starter: 120,
  pro: 300,
  agency: 600,
};

/**
 * Per-user abuse/cost guard for expensive AI endpoints. Counts the user's LLM calls over the last
 * hour from `generation_events` (shared across serverless instances, unlike an in-memory map).
 * Returns a 429 response when over the limit, otherwise null. Fails open if the DB check errors.
 */
export async function aiRateLimit(userId: string): Promise<NextResponse | null> {
  try {
    const db = getServiceSupabase();
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const [{ data: user }, { count }] = await Promise.all([
      db.from("users").select("plan").eq("id", userId).single(),
      db.from("generation_events").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    ]);
    const limit = HOURLY_LLM_CALLS[user?.plan || "free"] ?? HOURLY_LLM_CALLS.free;
    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: "You've reached the hourly AI usage limit for your plan. Please try again later.", rate_limited: true },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
  }
  return null;
}
