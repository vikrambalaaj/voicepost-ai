import { NextRequest } from "next/server";
import { getServiceSupabase } from "./supabase";
import { verifySessionCookie } from "./session";

export async function getAuthenticatedUserId(req: NextRequest): Promise<string | null> {
  const session = req.cookies.get("vp_session")?.value;

  if (session) {
    // Use HMAC-verified session parsing — rejects forged or expired cookies
    const decoded = verifySessionCookie(session);
    if (decoded?.userId) {
      return decoded.userId;
    }
  }

  // Development-only fallback: Return the user who has a connected real LinkedIn account.
  // IMPORTANT: This fallback only runs when there is no valid session cookie.
  // It is intentionally restricted to real (non-mock) accounts to prevent
  // accidental data leakage in shared environments.
  if (process.env.NODE_ENV !== "production") {
    try {
      const db = getServiceSupabase();
      const { data: realAccounts } = await db
        .from("linkedin_accounts")
        .select("user_id")
        .not("linkedin_profile_id", "like", "urn:li:person:mock_%")
        .eq("is_primary", true)
        .limit(1);

      if (realAccounts?.[0]?.user_id) {
        return realAccounts[0].user_id;
      }
    } catch (err) {
      console.error("Auth fallback DB query failed:", err);
    }
  }

  return null;
}
