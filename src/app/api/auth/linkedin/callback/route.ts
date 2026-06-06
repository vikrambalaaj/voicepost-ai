import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";

// Creates a signed session cookie value (base64 JSON — in production use JWT + secret)
function createSessionCookie(payload: Record<string, any>): string {
  const data = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state") || "";
  const storedStateRaw = req.cookies.get("linkedin_oauth_state")?.value || "";

  // Parse purpose from state (format: "csrfToken:purpose")
  const [stateToken, purpose] = stateParam.split(":");
  const [storedToken] = storedStateRaw.split(":");
  const loginPurpose = purpose === "login" || req.nextUrl.searchParams.get("purpose") === "login";

  // CSRF check for real OAuth codes
  if (code !== "mock_code" && storedToken && stateToken !== storedToken) {
    return NextResponse.json({ error: "State mismatch. CSRF validation failed." }, { status: 400 });
  }

  const db = getServiceSupabase();

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  const isMock = code === "mock_code" || !clientId || !clientSecret || !redirectUri;

  // Default mock account info
  let accountInfo: any = {
    linkedin_profile_id: "urn:li:person:mock_john_doe",
    access_token: "mock_token_" + Math.random().toString(36).substring(2),
    profile_name: "John Doe",
    profile_headline: "Founder at TechStart | Building AI automation for creators",
    profile_picture_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    profile_email: "demo@voicepost.com",
  };

  if (!isMock && code) {
    try {
      // Exchange code for access token
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri!,
          client_id: clientId!,
          client_secret: clientSecret!,
        }),
      });

      if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.statusText}`);
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch profile
      const profileRes = await fetch("https://api.linkedin.com/v2/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.statusText}`);
      const profileData = await profileRes.json();

      // Fetch email
      let profileEmail = "";
      try {
        const emailRes = await fetch(
          "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          profileEmail = emailData.elements?.[0]?.["handle~"]?.emailAddress || "";
        }
      } catch (_) {}

      accountInfo = {
        linkedin_profile_id: `urn:li:person:${profileData.id}`,
        access_token: accessToken,
        profile_name: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
        profile_headline: "LinkedIn Professional",
        profile_picture_url:
          profileData.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier || "",
        profile_email: profileEmail,
      };
    } catch (err: any) {
      console.error("LinkedIn OAuth error:", err);
      const dest = loginPurpose ? "/login?error=oauth_failed" : "/settings/linkedin?status=error";
      return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
    }
  }

  // --- Upsert User ---
  let userId: string;

  if (isMock) {
    // Demo mode: use or create a fixed demo user
    const demoId = "00000000-0000-0000-0000-000000000000";
    await db.from("users").upsert({
      id: demoId,
      email: accountInfo.profile_email || "demo@voicepost.com",
      full_name: accountInfo.profile_name,
      industry: "SaaS & AI",
      job_title: "Tech Founder",
      plan: "pro",
    }).select();
    userId = demoId;
  } else {
    // Real user — upsert by linkedin_profile_id via email
    const { data: existingUsers } = await db
      .from("users")
      .select("id")
      .eq("email", accountInfo.profile_email)
      .limit(1);

    if (existingUsers?.[0]) {
      userId = existingUsers[0].id;
      // Update name/picture
      await db.from("users").update({
        full_name: accountInfo.profile_name,
      }).eq("id", userId);
    } else {
      // Create new user
      const newUserId = randomUUID();
      const { data: newUser, error: userError } = await db.from("users").insert({
        id: newUserId,
        email: accountInfo.profile_email,
        full_name: accountInfo.profile_name,
        industry: "Professional",
        job_title: "",
        plan: "free",
      }).select().single();
      
      if (userError) {
        console.error("Failed to insert user into DB:", userError);
      }
      userId = newUser?.id || newUserId;
    }
  }

  // --- Upsert LinkedIn Account ---
  const { data: linkedinAccount, error: accError } = await db
    .from("linkedin_accounts")
    .upsert({
      user_id: userId,
      linkedin_profile_id: accountInfo.linkedin_profile_id,
      access_token: accountInfo.access_token,
      profile_name: accountInfo.profile_name,
      profile_headline: accountInfo.profile_headline,
      profile_picture_url: accountInfo.profile_picture_url,
      profile_email: accountInfo.profile_email || "",
      scraping_status: "running",
      is_primary: true,
      last_scraped_at: new Date().toISOString(),
    }, { onConflict: "user_id,linkedin_profile_id" })
    .select()
    .single();

  if (accError) {
    console.error("Failed to save linkedin account:", accError);
    const dest = loginPurpose ? "/login?error=db_error" : "/settings/linkedin?status=db_error";
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  // Trigger background post scraping
  try {
    fetch(`${req.nextUrl.origin}/api/linkedin/scrape-posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accountId: linkedinAccount.id }),
    }).catch(() => {});
  } catch (_) {}

  // --- Build redirect response ---
  const redirectDest = loginPurpose ? "/dashboard" : "/settings/linkedin?status=connected";
  const response = NextResponse.redirect(new URL(redirectDest, req.nextUrl.origin));

  // Set session cookie (30-day expiry)
  const sessionPayload = createSessionCookie({
    userId,
    email: accountInfo.profile_email,
    name: accountInfo.profile_name,
    picture: accountInfo.profile_picture_url,
    linkedin_connected: true,
  });

  response.cookies.set("vp_session", sessionPayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    sameSite: "lax",
  });

  // Clear CSRF cookie
  response.cookies.delete("linkedin_oauth_state");

  return response;
}
