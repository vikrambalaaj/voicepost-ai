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

  // Fallback: Return the first user in the database (useful for local development/mock mode)
  try {
    const db = getServiceSupabase();
    const { data: users } = await db.from("users").select("id").limit(1);
    return users?.[0]?.id || null;
  } catch (err) {
    console.error("Database user query fallback failed:", err);
    return null;
  }
}
