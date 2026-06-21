import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

async function verifyAdmin(req: NextRequest) {
  const db = getServiceSupabase();
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: user } = await db.from("users").select("role").eq("id", userId).single();
  if (user?.role !== "admin") return { error: "Access Denied", status: 403 };

  return { success: true };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await verifyAdmin(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const db = getServiceSupabase();
  const { id } = params;

  const { data: user, error } = await db
    .from("users")
    .select("id, email, plan, role, created_at, posts_used_this_week")
    .eq("id", id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Mask email
  const parts = user.email.split("@");
  const local = parts[0] || "";
  const domain = parts[1] || "";
  const maskedLocal = local.length > 2 ? local.substring(0, 1) + "***" + local.substring(local.length - 1) : "***";
  const maskedEmail = `${maskedLocal}@${domain}`;

  return NextResponse.json({
    success: true,
    user: {
      ...user,
      email: maskedEmail,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await verifyAdmin(req);
  if (authCheck.error) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  const db = getServiceSupabase();
  const { id } = params;

  try {
    const body = await req.json();
    const { plan, role } = body;

    const { data: user, error } = await db
      .from("users")
      .update({ plan, role, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, email, plan, role, created_at")
      .single();

    if (error || !user) throw error;

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
