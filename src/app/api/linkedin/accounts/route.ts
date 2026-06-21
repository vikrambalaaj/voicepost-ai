import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  // Find active user
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all accounts connected to this user
    const { data: accounts, error } = await db
      .from("linkedin_accounts")
      .select("id, scraping_status, posts_scraped_count, profile_name, profile_picture_url, profile_email, linkedin_profile_id, profile_headline, is_primary, account_type, created_at")
      .eq("user_id", userId)
      .order("account_type", { ascending: true }) // 'organization' vs 'personal'. Wait, 'organization' is sorted after 'personal' alphabetically if descending, let's sort personal first: descending 'personal' > 'organization'
      .order("profile_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort so personal is first
    const sortedAccounts = (accounts || []).sort((a: any, b: any) => {
      if (a.account_type === "personal" && b.account_type !== "personal") return -1;
      if (a.account_type !== "personal" && b.account_type === "personal") return 1;
      return a.profile_name.localeCompare(b.profile_name);
    });

    return NextResponse.json({ success: true, accounts: sortedAccounts }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
