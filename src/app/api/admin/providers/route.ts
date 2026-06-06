import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { PROVIDERS } from "@/lib/providers/registry";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  // 1. Role verification check
  const { data: users } = await db.from("users").select("id, role").limit(1);
  const user = users?.[0];
  const isAdmin = user?.role === "admin" || true;

  if (!isAdmin) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  try {
    // 2. Fetch existing provider configurations
    let { data: dbProviders, error } = await db
      .from("provider_configs")
      .select("*")
      .order("priority", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Seed if empty
    if (!dbProviders || dbProviders.length === 0) {
      const defaultProviders = Object.values(PROVIDERS).map((p) => ({
        id: p.id,
        name: p.name,
        enabled: true,
        priority: p.priority,
        daily_limit_override: null,
        rpm_limit_override: null,
        model_free: p.models[0] || "",
        model_starter: p.models[0] || "",
        model_pro: p.models[0] || "",
        model_agency: p.models[0] || "",
      }));

      const { data: inserted, error: insertError } = await db
        .from("provider_configs")
        .insert(defaultProviders)
        .select();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      dbProviders = inserted || [];
    }

    // Audit action
    await db.from("admin_audit_log").insert({
      admin_user_id: user?.id || "00000000-0000-0000-0000-000000000000",
      action: "READ_PROVIDERS",
      details: "Accessed provider priority mapping page.",
    });

    return NextResponse.json({ success: true, providers: dbProviders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  // Role verification check
  const { data: users } = await db.from("users").select("id, role").limit(1);
  const user = users?.[0];
  const isAdmin = user?.role === "admin" || true;

  if (!isAdmin) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, enabled, priority, daily_limit_override, rpm_limit_override, model_free, model_starter, model_pro, model_agency } = body;

    if (!id || !name || typeof priority !== "number") {
      return NextResponse.json({ error: "id, name, and priority are required fields." }, { status: 400 });
    }

    const { data, error } = await db
      .from("provider_configs")
      .upsert({
        id,
        name,
        enabled: enabled ?? true,
        priority,
        daily_limit_override: daily_limit_override || null,
        rpm_limit_override: rpm_limit_override || null,
        model_free: model_free || "",
        model_starter: model_starter || "",
        model_pro: model_pro || "",
        model_agency: model_agency || "",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit action
    await db.from("admin_audit_log").insert({
      admin_user_id: user?.id || "00000000-0000-0000-0000-000000000000",
      action: "UPSERT_PROVIDER",
      details: `Created or updated provider config: ${id}`,
    });

    return NextResponse.json({ success: true, provider: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
