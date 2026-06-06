import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  const purpose = req.nextUrl.searchParams.get("purpose") || "connect"; // "login" | "connect"
  const demo = req.nextUrl.searchParams.get("demo") === "true";

  // Demo mode — skip real OAuth, go straight to mock callback
  if (demo || !clientId || !redirectUri) {
    const mockCallbackUrl = new URL(
      `/api/auth/linkedin/callback?code=mock_code&state=mock_state&purpose=${purpose}`,
      req.nextUrl.origin
    );
    return NextResponse.redirect(mockCallbackUrl);
  }

  const csrfToken = Math.random().toString(36).substring(2, 15);

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "r_liteprofile r_emailaddress w_member_social");
  // Encode the purpose in the state so callback knows what to do
  authUrl.searchParams.set("state", `${csrfToken}:${purpose}`);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("linkedin_oauth_state", `${csrfToken}:${purpose}`, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600,
  });

  return response;
}
