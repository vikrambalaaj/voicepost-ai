import { NextRequest, NextResponse } from "next/server";

// Routes that don't require a session cookie (each handles its own auth where needed)
const PUBLIC_PATHS = [
  "/login",
  "/pricing",
  "/api/auth/linkedin",
  "/api/auth/linkedin/callback",
  "/api/linkedin/scrape-posts",
  "/api/style/analyze",
  "/api/notify/email",
  "/api/webhooks/stripe", // verified by Stripe signature
];
// Verified by CRON_SECRET bearer token inside the route (Vercel cron sends no cookie)
const PUBLIC_PREFIXES = ["/api/cron/"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

// Verifies the HMAC signature (Web Crypto: middleware runs on the edge runtime) and expiry.
async function verifySession(cookie: string | undefined): Promise<Record<string, any> | null> {
  if (!cookie) return null;
  try {
    let secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
      if (process.env.NODE_ENV === "production") return null; // fail closed
      secret = "voicepost-dev-secret-change-in-production";
    }
    const dot = cookie.lastIndexOf(".");
    if (dot === -1) return null;
    const encoded = cookie.substring(0, dot);
    const sig = hexToBytes(cookie.substring(dot + 1));
    if (!encoded || !sig) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify("HMAC", key, sig as unknown as BufferSource, new TextEncoder().encode(encoded));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(b64ToBytes(encoded)));
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function toLogin(req: NextRequest, from?: string, clear = false) {
  const url = new URL("/login", req.nextUrl.origin);
  if (from) url.searchParams.set("from", from);
  const res = NextResponse.redirect(url);
  if (clear) res.cookies.delete("vp_session");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rawSession = req.cookies.get("vp_session")?.value;

  // Root path: dashboard if logged in, otherwise login
  if (pathname === "/") {
    const ok = await verifySession(rawSession);
    return NextResponse.redirect(new URL(ok ? "/dashboard" : "/login", req.nextUrl.origin));
  }

  // Logged-in users never need the login page
  if (pathname === "/login" && rawSession && (await verifySession(rawSession))) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // Allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/manifest") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!rawSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return toLogin(req, pathname);
  }

  const decoded = await verifySession(rawSession);
  if (!decoded) {
    if (pathname.startsWith("/api/")) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      res.cookies.delete("vp_session");
      return res;
    }
    return toLogin(req, pathname, true);
  }

  // Gate admin console and admin API routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const ADMIN_EMAILS = ["vikram.bala@digitalfoundry.ai", "vikrambalauae.aj@gmail.com"];
    const userEmail = decoded?.email;
    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      if (pathname.startsWith("/api/admin")) {
        return new NextResponse(
          JSON.stringify({ error: "Forbidden: Admins only" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      } else {
        return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest.json, icons
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icon|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
