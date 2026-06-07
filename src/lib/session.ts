import { createHmac } from "crypto";

const SESSION_SECRET = process.env.SESSION_SECRET || "voicepost-dev-secret-change-in-production";

// Creates an HMAC-SHA256 signed session cookie to prevent forgery.
// Format: base64(payload).HMAC_SIGNATURE
export function createSessionCookie(payload: Record<string, any>): string {
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64");
  const sig = createHmac("sha256", SESSION_SECRET).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

// Verify and decode a signed session cookie. Returns null if invalid or expired.
export function verifySessionCookie(cookie: string): Record<string, any> | null {
  try {
    const dotIndex = cookie.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const encoded = cookie.substring(0, dotIndex);
    const sig = cookie.substring(dotIndex + 1);
    if (!encoded || !sig) return null;

    const expectedSig = createHmac("sha256", SESSION_SECRET).update(encoded).digest("hex");
    if (sig !== expectedSig) return null; // Forgery attempt

    const data = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    if (data.exp && data.exp < Date.now()) return null; // Expired
    return data;
  } catch {
    return null;
  }
}
