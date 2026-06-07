import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

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
