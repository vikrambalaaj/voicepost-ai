import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Diagnostic endpoint — checks all expected tables exist in Supabase
// Access: GET /api/admin/db-check?secret=vp_diag_2026
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== "vp_diag_2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getServiceSupabase();

  const expectedTables = [
    "users",
    "linkedin_accounts",
    "style_profiles",
    "expert_styles",
    "custom_styles",
    "user_posts_raw",
    "posts",
    "post_revisions",
    "post_images",
    "voice_recordings",
    "generation_events",
    "user_sessions",
    "provider_configs",
    "provider_usage_daily",
    "api_keys",
    "audit_logs",
  ];

  const results: Record<string, { exists: boolean; row_count?: number; error?: string }> = {};

  for (const table of expectedTables) {
    try {
      const { count, error } = await (sb as any)
        .from(table)
        .select("*", { count: "exact", head: true });

      if (error) {
        results[table] = { exists: false, error: error.message };
      } else {
        results[table] = { exists: true, row_count: count ?? 0 };
      }
    } catch (e: any) {
      results[table] = { exists: false, error: e.message };
    }
  }

  const allExist = Object.values(results).every((r) => r.exists);
  const missing = Object.entries(results)
    .filter(([, v]) => !v.exists)
    .map(([k]) => k);

  return NextResponse.json({
    status: allExist ? "ALL_OK" : "MISSING_TABLES",
    total_tables_expected: expectedTables.length,
    missing_tables: missing,
    details: results,
  });
}
