import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  const db = getServiceSupabase();

  // Find the active authenticated user
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get active account
  const { data: accounts } = await db
    .from("linkedin_accounts")
    .select("id, access_token")
    .eq("user_id", userId);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: "No LinkedIn account connected" }, { status: 200 });
  }

  // 1. Revoke LinkedIn tokens if not mock
  for (const account of accounts) {
    if (account.access_token && !account.access_token.startsWith("mock_")) {
      try {
        await fetch("https://www.linkedin.com/oauth/v2/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: account.access_token,
            client_id: process.env.LINKEDIN_CLIENT_ID || "",
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
          }),
        });
      } catch (e) {
        console.warn("Failed to revoke LinkedIn token via API. Continuing with DB purge.");
      }
    }
  }

  // 2. Database purge
  // Delete raw posts
  const { error: rawError } = await db.from("user_posts_raw").delete().eq("user_id", userId);
  if (rawError) console.error("Error deleting user_posts_raw:", rawError);

  // Delete style profiles
  const { error: styleError } = await db.from("style_profiles").delete().eq("user_id", userId);
  if (styleError) console.error("Error deleting style_profiles:", styleError);

  // Delete all connected accounts/pages
  const { error: accError } = await db.from("linkedin_accounts").delete().eq("user_id", userId);
  if (accError) {
    console.error("Error deleting accounts:", accError);
    return NextResponse.json({ error: "Failed to disconnect accounts from database" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Disconnected successfully" }, { status: 200 });
}
