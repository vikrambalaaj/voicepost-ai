import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = req.cookies.get("vp_session")?.value;

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const decoded = JSON.parse(Buffer.from(session, "base64").toString("utf-8"));

    if (decoded.exp && decoded.exp < Date.now()) {
      const res = NextResponse.json({ authenticated: false, reason: "expired" });
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
  } catch {
    return NextResponse.json({ authenticated: false, reason: "invalid" });
  }
}
