import { NextRequest } from "next/server";
import { getServiceSupabase } from "./supabase";
import { getAuthenticatedUserId } from "./auth";

export type AdminCheck =
  | { error: string; status: number }
  | { success: true; userId: string };

/** Verifies the HMAC-signed session AND that users.role === 'admin' in the DB. */
export async function verifyAdmin(req: NextRequest): Promise<AdminCheck> {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return { error: "Unauthorized", status: 401 };
  const db = getServiceSupabase();
  const { data: user } = await db.from("users").select("role").eq("id", userId).single();
  if (user?.role !== "admin") return { error: "Access Denied", status: 403 };
  return { success: true, userId };
}

/** Cron routes: fail closed when CRON_SECRET is unset. */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
