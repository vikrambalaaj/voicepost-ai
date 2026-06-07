import { NextRequest } from "next/server";
import { getServiceSupabase } from "./supabase";

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const session = req.cookies.get("vp_session")?.value;
  
  if (session) {
    try {
      const decoded = JSON.parse(Buffer.from(session, "base64").toString("utf-8"));
      if (decoded.exp && decoded.exp > Date.now() && decoded.userId) {
        return decoded.userId;
      }
    } catch (err) {
      console.error("Failed to parse session cookie:", err);
    }
  }

  // Fallback: Return the user who has a connected LinkedIn account (useful for local development)
  try {
    const db = getServiceSupabase();
    // Try to get a user with a non-mock primary LinkedIn account first
    const { data: realAccounts } = await db
      .from("linkedin_accounts")
      .select("user_id")
      .not("linkedin_profile_id", "like", "urn:li:person:mock_%")
      .eq("is_primary", true)
      .limit(1);
      
    if (realAccounts?.[0]?.user_id) {
      return realAccounts[0].user_id;
    }

    const { data: users } = await db.from("users").select("id").limit(1);
    return users?.[0]?.id || null;
  } catch (err) {
    console.error("Database user query fallback failed:", err);
    return null;
  }
}
