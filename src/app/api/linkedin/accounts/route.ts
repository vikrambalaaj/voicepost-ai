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
      .select("id, scraping_status, posts_scraped_count, profile_name, profile_picture_url, profile_email, linkedin_profile_id, profile_headline, is_primary, created_at")
      .eq("user_id", userId)
      .order("profile_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to include account_type dynamically based on URN type
    const processedAccounts = (accounts || []).map((acc: any) => ({
      ...acc,
      account_type: acc.linkedin_profile_id?.startsWith("urn:li:person:") ? "personal" : "organization"
    }));

    // Sort so personal is first
    const sortedAccounts = processedAccounts.sort((a: any, b: any) => {
      if (a.account_type === "personal" && b.account_type !== "personal") return -1;
      if (a.account_type !== "personal" && b.account_type === "personal") return 1;
      return a.profile_name.localeCompare(b.profile_name);
    });

    return NextResponse.json({ success: true, accounts: sortedAccounts }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
