import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: currentUser } = await db
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (currentUser?.role !== "admin") {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  // Audit and verify role
  const { data: usersData, error } = await db
    .from("users")
    .select("id, email, plan, created_at, role");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask emails: j***@gmail.com
  const maskedUsers = (usersData || []).map((u: any) => {
    const parts = u.email.split("@");
    const local = parts[0] || "";
    const domain = parts[1] || "";
    const maskedLocal = local.length > 2 ? local.substring(0, 1) + "***" + local.substring(local.length - 1) : "***";
    return {
      id: u.id,
      email: `${maskedLocal}@${domain}`,
      plan: u.plan,
      role: u.role,
      created_at: u.created_at,
    };
  });

  return NextResponse.json({ success: true, users: maskedUsers });
}
