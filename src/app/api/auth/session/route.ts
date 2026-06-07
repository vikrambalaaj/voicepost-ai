import { NextRequest, NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("vp_session")?.value;

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const decoded = verifySessionCookie(session);
  if (!decoded) {
    const res = NextResponse.json({ authenticated: false, reason: "invalid_or_expired" });
    res.cookies.delete("vp_session");
    return res;
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      linkedin_connected: decoded.linkedin_connected,
    },
  });
}
