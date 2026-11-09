import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { verifyAdmin } from "@/lib/admin";

// Diagnostic endpoint — checks all expected tables exist in Supabase
// Access: admin session only (users.role = 'admin')
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authCheck = await verifyAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
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
