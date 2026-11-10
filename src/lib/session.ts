import { createHmac, timingSafeEqual } from "crypto";

const DEV_FALLBACK_SECRET = "voicepost-dev-secret-change-in-production";

// In production a missing SESSION_SECRET must fail closed: a hard-coded fallback
// would let anyone who reads the source forge a session cookie.
function getSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") return null;
  return DEV_FALLBACK_SECRET;
}

// Creates an HMAC-SHA256 signed session cookie to prevent forgery.
// Format: base64(payload).HMAC_SIGNATURE
export function createSessionCookie(payload: Record<string, any>): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET is not set (min 16 chars). Refusing to issue a session.");
  }
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64");
  const sig = createHmac("sha256", secret).update(encoded).digest("hex");
  return `${encoded}.${sig}`;
}

// Verify and decode a signed session cookie. Returns null if invalid or expired.
export function verifySessionCookie(cookie: string): Record<string, any> | null {
  try {
    const secret = getSecret();
    if (!secret) return null;
    const dotIndex = cookie.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const encoded = cookie.substring(0, dotIndex);
    const sig = cookie.substring(dotIndex + 1);
    if (!encoded || !sig) return null;

    const expectedSig = createHmac("sha256", secret).update(encoded).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null; // Forgery attempt

    const data = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    if (data.exp && data.exp < Date.now()) return null; // Expired
    return data;
  } catch {
    return null;
  }
}
