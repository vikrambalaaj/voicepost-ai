import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  // Find active user
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { accountId } = await req.json();

    if (!accountId) {
      return NextResponse.json({ error: "accountId is required" }, { status: 400 });
    }

    // 1. Verify account belongs to user
    const { data: targetAccount, error: fetchErr } = await db
      .from("linkedin_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("user_id", userId)
      .limit(1);

    if (fetchErr || !targetAccount || targetAccount.length === 0) {
      return NextResponse.json({ error: "Account not found or unauthorized" }, { status: 404 });
    }

    // 2. Set all user's accounts to not primary
    const { error: resetErr } = await db
      .from("linkedin_accounts")
      .update({ is_primary: false })
      .eq("user_id", userId);

    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 500 });
    }

    // 3. Set chosen account as primary
    const { error: updateErr } = await db
      .from("linkedin_accounts")
      .update({ is_primary: true })
      .eq("id", accountId)
      .eq("user_id", userId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Active account switched successfully" }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
