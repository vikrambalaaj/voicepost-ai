import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isDemoLoginEnabled } from "@/lib/demo";

export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  let redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (redirectUri) {
    const origin = req.nextUrl.origin;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      redirectUri = `${origin}/api/auth/linkedin/callback`;
    }
  }

  const purpose = req.nextUrl.searchParams.get("purpose") === "login" ? "login" : "connect";
  const demo = req.nextUrl.searchParams.get("demo") === "true";

  const csrfToken = randomBytes(24).toString("hex");
  const stateCookie = {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
  };

  const oauthConfigured = Boolean(clientId && redirectUri && process.env.LINKEDIN_CLIENT_SECRET);
  // Production must never fall back to the demo account because OAuth is misconfigured.
  if (!demo && !oauthConfigured && process.env.NODE_ENV === "production") {
    const dest = purpose === "login" ? "/login?error=server_config" : "/settings/linkedin?status=error";
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  // Demo mode — skip real OAuth but still bind the callback to a state cookie.
  if (demo || !oauthConfigured) {
    if (!isDemoLoginEnabled()) {
      return NextResponse.redirect(new URL("/login?error=demo_disabled", req.nextUrl.origin));
    }
    const mockCallbackUrl = new URL("/api/auth/linkedin/callback", req.nextUrl.origin);
    mockCallbackUrl.searchParams.set("code", "mock_code");
    mockCallbackUrl.searchParams.set("state", `${csrfToken}:${purpose}`);
    mockCallbackUrl.searchParams.set("purpose", purpose);
    const res = NextResponse.redirect(mockCallbackUrl);
    res.cookies.set("linkedin_oauth_state", `${csrfToken}:${purpose}`, stateCookie);
    return res;
  }

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("redirect_uri", redirectUri!);
  authUrl.searchParams.set("scope", "openid profile email w_member_social r_organization_admin w_organization_social");
  // Encode the purpose in the state so callback knows what to do
  authUrl.searchParams.set("state", `${csrfToken}:${purpose}`);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("linkedin_oauth_state", `${csrfToken}:${purpose}`, stateCookie);

  return response;
}
