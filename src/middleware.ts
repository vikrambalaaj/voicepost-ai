import { NextRequest, NextResponse } from "next/server";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/pricing",
  "/api/auth/linkedin",
  "/api/auth/linkedin/callback",
  "/api/admin/db-check",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("vp_session")?.value;

  // Root path behavior: redirect to dashboard if logged in, otherwise login
  if (pathname === "/") {
    if (session) {
      try {
        const dotIndex = session.lastIndexOf(".");
        const encoded = dotIndex === -1 ? session : session.substring(0, dotIndex);
        const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
        if (decoded.exp && decoded.exp > Date.now()) {
          return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
        }
      } catch {}
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
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

  // Check for session cookie
  if (!session) {
    // Redirect to login page
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate session is not expired (simple base64 JSON check)
  try {
    const dotIndex = session.lastIndexOf(".");
    const encoded = dotIndex === -1 ? session : session.substring(0, dotIndex);
    const decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    if (decoded.exp && decoded.exp < Date.now()) {
      // Expired — clear cookie and redirect to login
      const loginUrl = new URL("/login", req.nextUrl.origin);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete("vp_session");
      return res;
    }
  } catch {
    // Malformed session — send to login
    const loginUrl = new URL("/login", req.nextUrl.origin);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("vp_session");
    return res;
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
