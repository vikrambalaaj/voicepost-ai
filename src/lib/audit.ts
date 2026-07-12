import { getServiceSupabase } from "./supabase";

export async function logAuditEvent({
  userId,
  action,
  targetType,
  targetId,
  details = {},
  ipAddress,
  userAgent,
}: {
  userId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const db = getServiceSupabase();
    const { error } = await db.from("audit_logs").insert({
      user_id: userId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    });

    if (error) {
      console.error(`[Audit Log Error] Failed to insert audit log for action ${action}:`, error);
    }
  } catch (err) {
    console.error(`[Audit Log Exception] Failed to log audit event for action ${action}:`, err);
  }
}
