import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const storedState = req.cookies.get("linkedin_oauth_state")?.value;

  // Verify CSRF state for real code
  if (code !== "mock_code" && storedState && state !== storedState) {
    return NextResponse.json({ error: "State mismatch. CSRF validation failed." }, { status: 400 });
  }

  const db = getServiceSupabase();
  
  // We need a user session to associate the LinkedIn account. 
  // In a real app we get this from Supabase auth. 
  // For demo/standalone purposes, we'll grab the first user or mock one if none exists.
  let { data: users } = await db.from("users").select("id").limit(1);
  let userId = users?.[0]?.id;

  if (!userId) {
    // Let's create a mock user in the public.users table if there are no users yet.
    // In production, the user would already be authenticated.
    const tempUserId = "00000000-0000-0000-0000-000000000000";
    const { data: newUser } = await db.from("users").upsert({
      id: tempUserId,
      email: "demo@voicepost.com",
      full_name: "John Doe",
      industry: "SaaS & AI",
      job_title: "Tech Founder",
      plan: "pro", // default to pro for testing all features
    }).select().single();
    userId = tempUserId;
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI;

  let accountInfo: any = {
    linkedin_profile_id: "urn:li:person:mock_john_doe",
    access_token: "mock_token_" + Math.random().toString(36).substring(2),
    profile_name: "John Doe",
    profile_headline: "Founder at TechStart | Building AI automation for creators",
    profile_picture_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    profile_email: "demo@voicepost.com",
  };

  const isMock = code === "mock_code" || !clientId || !clientSecret || !redirectUri;

  if (isMock) {
    return NextResponse.json({ error: "LinkedIn OAuth connection failed. Please ensure LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI are configured in your environment variables." }, { status: 400 });
  }

  if (code) {
    try {
      // Exchange authorization code for access token
      const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
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

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Fetch Profile
      const profileResponse = await fetch("https://api.linkedin.com/v2/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileResponse.ok) {
        throw new Error(`Profile fetch failed: ${profileResponse.statusText}`);
      }

      const profileData = await profileResponse.json();
      
      // Fetch email address
      let profileEmail = "";
      try {
        const emailResponse = await fetch(
          "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          profileEmail = emailData.elements?.[0]?.["handle~"]?.emailAddress || "";
        }
      } catch (_) {}

      accountInfo = {
        linkedin_profile_id: `urn:li:person:${profileData.id}`,
        access_token: accessToken,
        profile_name: `${profileData.localizedFirstName} ${profileData.localizedLastName}`,
        profile_headline: "LinkedIn Professional",
        profile_picture_url: profileData.profilePicture?.["displayImage~"]?.elements?.[0]?.identifiers?.[0]?.identifier || "",
        profile_email: profileEmail,
      };
    } catch (error: any) {
      console.error("Error in LinkedIn OAuth Callback:", error);
      return NextResponse.redirect(new URL("/settings/linkedin?status=error", req.nextUrl.origin));
    }
  }

  // Save/Upsert account
  const { data: linkedinAccount, error: accError } = await db.from("linkedin_accounts").upsert({
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
  }, { onConflict: "user_id,linkedin_profile_id" }).select().single();

  // Update user email if we obtained it from LinkedIn
  if (accountInfo.profile_email) {
    await db.from("users").update({
      email: accountInfo.profile_email,
      full_name: accountInfo.profile_name,
    }).eq("id", userId);
  }

  if (accError) {
    console.error("Failed to save linkedin account:", accError);
    return NextResponse.redirect(new URL("/settings/linkedin?status=db_error", req.nextUrl.origin));
  }

  // Trigger real background scraping via async fetch (Supabase Edge Function mockup)
  // For local dev, we run a background task or mock it if Edge function is not deployed
  try {
    fetch(`${req.nextUrl.origin}/api/linkedin/scrape-posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accountId: linkedinAccount.id }),
    }).catch(() => {});
  } catch (e) {}

  const redirectUrl = new URL("/settings/linkedin", req.nextUrl.origin);
  redirectUrl.searchParams.set("status", "connected");
  return NextResponse.redirect(redirectUrl);
}
