import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  // 1. Role verification check
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await db
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  // 2. Fetch non-content logs
  // User count and plans
  const { data: plansData } = await db.from("users").select("plan");
  const plans = plansData || [];

  const mrr = plans.reduce((acc: number, curr: any) => {
    if (curr.plan === "starter") return acc + 5;
    if (curr.plan === "pro") return acc + 12;
    if (curr.plan === "agency") return acc + 29;
    return acc;
  }, 0);

  // Generation stats
  const { data: genEvents } = await db
    .from("generation_events")
    .select("provider_succeeded, success, total_latency_ms")
    .limit(100);

  const totalRequests = genEvents?.length || 0;
  const successfulRequests = genEvents?.filter((e: any) => e.success).length || 0;
  const failureRate = totalRequests > 0 ? ((totalRequests - successfulRequests) / totalRequests) * 100 : 0;
  
  const avgLatency =
    totalRequests > 0
      ? (genEvents?.reduce((acc: number, curr: any) => acc + (curr.total_latency_ms || 0), 0) || 0) / totalRequests
      : 0;

  // Log auditing
  await db.from("admin_audit_log").insert({
    admin_user_id: user?.id || "00000000-0000-0000-0000-000000000000",
    action: "READ_OVERVIEW",
    details: "Accessed operational dashboard telemetry.",
  });

  return NextResponse.json({
    success: true,
    metrics: {
      total_users: plans.length,
      mrr: `$${mrr}`,
      total_requests: totalRequests,
      failure_rate: `${failureRate.toFixed(1)}%`,
      avg_latency: `${(avgLatency / 1000).toFixed(2)}s`,
    },
    provider_health: {
      nvidia: { status: "operational", latency: "1.2s" },
      google: { status: "operational", latency: "0.8s" },
      groq: { status: "operational", latency: "0.4s" },
    }
  });
}
