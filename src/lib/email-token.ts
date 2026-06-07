import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET || "voicepost-dev-secret-change-in-production";
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a signed one-click email action token.
 * Embeds postId, action, and expiry — signed with HMAC-SHA256.
 */
export function createEmailActionToken(postId: string, action: "approve" | "reject"): string {
  const payload = {
    postId,
    action,
    exp: Date.now() + EXPIRY_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a one-click email action token.
 * Returns { postId, action } or null if invalid / expired.
 */
export function verifyEmailActionToken(
  token: string
): { postId: string; action: "approve" | "reject" } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = token.substring(0, dot);
    const sig = token.substring(dot + 1);

    const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(sig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
    if (payload.exp < Date.now()) return null; // Expired

    if (!payload.postId || !payload.action) return null;
    return { postId: payload.postId, action: payload.action };
  } catch {
    return null;
  }
}
