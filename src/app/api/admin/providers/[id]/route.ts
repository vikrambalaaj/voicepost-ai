import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { verifyAdmin } from "@/lib/admin";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase();
  const { id } = params;

  const authCheck = await verifyAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const { data, error } = await db
      .from("provider_configs")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const { api_key_encrypted: _omit, ...safe } = (data || {}) as any;
    return NextResponse.json({ success: true, provider: safe });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase();
  const { id } = params;

  const authCheck = await verifyAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const body = await req.json();

    const { data, error } = await db
      .from("provider_configs")
      .update({
        name: body.name,
        enabled: body.enabled,
        priority: body.priority,
        daily_limit_override: body.daily_limit_override === "" ? null : body.daily_limit_override,
        rpm_limit_override: body.rpm_limit_override === "" ? null : body.rpm_limit_override,
        model_free: body.model_free,
        model_starter: body.model_starter,
        model_pro: body.model_pro,
        model_agency: body.model_agency,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit action
    await db.from("admin_audit_log").insert({
      admin_user_id: authCheck.userId,
      action: "UPDATE_PROVIDER",
      details: `Updated provider config for: ${id}`,
    });

    return NextResponse.json({ success: true, provider: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getServiceSupabase();
  const { id } = params;

  const authCheck = await verifyAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  try {
    const { error } = await db
      .from("provider_configs")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit action
    await db.from("admin_audit_log").insert({
      admin_user_id: authCheck.userId,
      action: "DELETE_PROVIDER",
      details: `Deleted provider config: ${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
