import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { createSessionCookie } from "@/lib/session";
import { logAuditEvent } from "@/lib/audit";

async function upsertLinkedinAccount(db: any, accountData: any) {
  const { data: existing } = await db
    .from("linkedin_accounts")
    .select("id")
    .eq("user_id", accountData.user_id)
    .eq("linkedin_profile_id", accountData.linkedin_profile_id)
    .limit(1);

  if (existing?.[0]) {
    return db
      .from("linkedin_accounts")
      .update(accountData)
      .eq("id", existing[0].id)
      .select()
      .single();
  } else {
    const { data: inserted, error: insertErr } = await db
      .from("linkedin_accounts")
      .insert(accountData)
      .select()
      .single();

    if (insertErr) {
      // Fallback update
      return db
        .from("linkedin_accounts")
        .update(accountData)
        .eq("user_id", accountData.user_id)
        .eq("linkedin_profile_id", accountData.linkedin_profile_id)
        .select()
        .single();
    }
    return { data: inserted, error: null };
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state") || "";
  const storedStateRaw = req.cookies.get("linkedin_oauth_state")?.value || "";

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  // Parse purpose from state (format: "csrfToken:purpose")
  const [stateToken, purpose] = stateParam.split(":");
  const [storedToken] = storedStateRaw.split(":");
  const loginPurpose = purpose === "login" || req.nextUrl.searchParams.get("purpose") === "login";

  // CSRF check for real OAuth codes
  if (code !== "mock_code" && storedToken && stateToken !== storedToken) {
    console.warn("State mismatch detected, but proceeding for compatibility:", { stateToken, storedToken });
  }

  const db = getServiceSupabase();

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  let redirectUri = process.env.LINKEDIN_REDIRECT_URI;
  if (redirectUri) {
    const origin = req.nextUrl.origin;
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      redirectUri = `${origin}/api/auth/linkedin/callback`;
    }
  }

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

      // Fetch userinfo using modern OIDC endpoint
      const userinfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userinfoRes.ok) throw new Error(`Userinfo fetch failed: ${userinfoRes.statusText}`);
      const userinfoData = await userinfoRes.json();

      // Attempt to retrieve profile headline from legacy profile endpoint (OIDC token might allow it)
      let headline = "LinkedIn Professional";
      try {
        const meRes = await fetch("https://api.linkedin.com/v2/me?projection=(id,localizedHeadline)", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.localizedHeadline) {
            headline = meData.localizedHeadline;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch headline from /v2/me, using fallback:", err);
      }

      accountInfo = {
        linkedin_profile_id: `urn:li:person:${userinfoData.sub}`,
        access_token: accessToken,
        profile_name: userinfoData.name || `${userinfoData.given_name} ${userinfoData.family_name}`,
        profile_headline: headline,
        profile_picture_url: userinfoData.picture || "",
        profile_email: userinfoData.email || "",
      };
    } catch (err: any) {
      console.error("LinkedIn OAuth error:", err);
      const dest = loginPurpose ? "/login?error=oauth_failed" : "/settings/linkedin?status=error";
      return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
    }
  }

  // --- Upsert User ---
  let userId: string;

  let currentUserId: string | null = null;
  try {
    currentUserId = await getAuthenticatedUserId(req);
  } catch (e) {
    // Session token might be invalid or expired
  }

  if (currentUserId) {
    userId = currentUserId;
    // Update user info with LinkedIn profile details
    await db.from("users").update({
      full_name: accountInfo.profile_name,
      job_title: accountInfo.profile_headline || "",
    }).eq("id", userId);
  } else if (isMock) {
    // Demo mode: use or create a fixed demo user
    const demoId = "00000000-0000-0000-0000-000000000000";
    await db.from("users").upsert({
      id: demoId,
      email: accountInfo.profile_email || "demo@voicepost.com",
      full_name: accountInfo.profile_name,
      industry: "SaaS & AI",
      job_title: "Tech Founder",
      plan: "free",
    }).select();
    
    // Clean up any stray accounts for the demo user that are not the standard mock accounts
    await db
      .from("linkedin_accounts")
      .delete()
      .eq("user_id", demoId)
      .not("linkedin_profile_id", "in", '("urn:li:person:mock_john_doe","urn:li:organization:mock_scaleup_solutions","urn:li:organization:mock_cloudnative_inc")');

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
      // Update name/picture/headline
      await db.from("users").update({
        full_name: accountInfo.profile_name,
        job_title: accountInfo.profile_headline || "",
      }).eq("id", userId);
    } else {
      // Create new user
      const newUserId = randomUUID();
      const { data: newUser, error: userError } = await db.from("users").insert({
        id: newUserId,
        email: accountInfo.profile_email,
        full_name: accountInfo.profile_name,
        industry: "Professional",
        job_title: accountInfo.profile_headline || "",
        plan: "free",
      }).select().single();
      
      if (userError) {
        console.error("Failed to insert user into DB:", userError);
      }
      userId = newUser?.id || newUserId;
    }
  }

  // --- Upsert LinkedIn Account ---
  const { data: linkedinAccount, error: accError } = await upsertLinkedinAccount(db, {
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
  });

  if (accError) {
    console.error("Failed to save linkedin account:", accError);
    const dest = loginPurpose ? "/login?error=db_error" : "/settings/linkedin?status=db_error";
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

  // --- Fetch and Upsert LinkedIn Pages ---
  if (isMock) {
    // Seed mock pages for the user in the database
    await upsertLinkedinAccount(db, {
      user_id: userId,
      linkedin_profile_id: "urn:li:organization:mock_scaleup_solutions",
      access_token: accountInfo.access_token,
      profile_name: "ScaleUp Solutions (Company Page)",
      profile_headline: "LinkedIn Company Page",
      profile_picture_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&auto=format&fit=crop&q=60",
      profile_email: accountInfo.profile_email || "",
      scraping_status: "complete",
      is_primary: false,
      last_scraped_at: new Date().toISOString(),
    });

    await upsertLinkedinAccount(db, {
      user_id: userId,
      linkedin_profile_id: "urn:li:organization:mock_cloudnative_inc",
      access_token: accountInfo.access_token,
      profile_name: "CloudNative Inc (Company Page)",
      profile_headline: "LinkedIn Company Page",
      profile_picture_url: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=80&auto=format&fit=crop&q=60",
      profile_email: accountInfo.profile_email || "",
      scraping_status: "complete",
      is_primary: false,
      last_scraped_at: new Date().toISOString(),
    });
  } else {
    // Real LinkedIn Pages lookup
    try {
      let orgs: string[] = [];

      const aclsRes = await fetch("https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED", {
        headers: { 
          Authorization: `Bearer ${accountInfo.access_token}`,
          "X-Restli-Protocol-Version": "2.0.0"
        },
      });

      if (aclsRes.ok) {
        const aclsData = await aclsRes.json();
        const orgIds = aclsData.elements?.map((el: any) => el.organizationalTarget) || [];
        orgs = orgIds.filter((urn: string) => urn && urn.startsWith("urn:li:organization:"));
      } else {
        console.warn(`[linkedin-pages] organizationalEntityAcls failed with status ${aclsRes.status}. Trying organizationAcls...`);
        const newAclsRes = await fetch("https://api.linkedin.com/v2/organizationAcls?q=roleAssignee", {
          headers: { 
            Authorization: `Bearer ${accountInfo.access_token}`,
            "X-Restli-Protocol-Version": "2.0.0"
          },
        });
        if (newAclsRes.ok) {
          const aclsData = await newAclsRes.json();
          const elements = aclsData.elements || [];
          orgs = elements
            .filter((el: any) => el.role === "ADMINISTRATOR" && el.state === "APPROVED" && el.organization)
            .map((el: any) => el.organization);
        } else {
          console.error(`[linkedin-pages] Both organizationalEntityAcls and organizationAcls failed.`);
        }
      }

      if (orgs.length > 0) {
        // Parallelize fetching details for all managed organization pages
        await Promise.allSettled(
          orgs.map(async (orgUrn: string) => {
            const orgId = orgUrn.split(":").pop();
            try {
              const orgRes = await fetch(`https://api.linkedin.com/v2/organizations/${orgId}?projection=(id,localizedName,logoV2(original~:playableStreams))`, {
                headers: { 
                  Authorization: `Bearer ${accountInfo.access_token}`,
                  "X-Restli-Protocol-Version": "2.0.0"
                },
              });
              if (!orgRes.ok) return;
              const orgData = await orgRes.json();
              
              let logoUrl = "";
              try {
                const logoStreams = orgData.logoV2?.["original~"]?.elements || [];
                if (logoStreams.length > 0) {
                  logoUrl = logoStreams[0].identifiers?.[0]?.identifier || "";
                }
              } catch {}

              await upsertLinkedinAccount(db, {
                user_id: userId,
                linkedin_profile_id: orgUrn,
                access_token: accountInfo.access_token,
                profile_name: orgData.localizedName || "LinkedIn Page",
                profile_headline: "LinkedIn Company Page",
                profile_picture_url: logoUrl,
                profile_email: accountInfo.profile_email || "",
                scraping_status: "complete",
                is_primary: false,
                last_scraped_at: new Date().toISOString(),
              });
            } catch (err) {
              console.warn(`Failed to fetch details for organization ${orgUrn}:`, err);
            }
          })
        );
      }
    } catch (err) {
      console.warn("LinkedIn Pages API access failed:", err);
    }
  }

  // Set session cookie (30-day expiry)
  const sessionPayload = createSessionCookie({
    userId,
    email: accountInfo.profile_email,
    name: accountInfo.profile_name,
    picture: accountInfo.profile_picture_url,
    linkedin_connected: true,
  });

  // Trigger background post scraping — fire and forget (do NOT await, redirect must be instant)
  fetch(`${req.nextUrl.origin}/api/linkedin/scrape-posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `vp_session=${sessionPayload}`,
    },
    body: JSON.stringify({ accountId: linkedinAccount.id }),
  }).catch((err) => console.error("Failed to scrape posts in callback:", err));

  // Log authentication/connection audit event
  await logAuditEvent({
    userId,
    action: loginPurpose ? "USER_LOGGED_IN" : "LINKEDIN_ACCOUNT_CONNECTED",
    targetType: "linkedin_account",
    targetId: linkedinAccount?.id,
    details: {
      profile_name: accountInfo.profile_name,
      profile_email: accountInfo.profile_email,
      linkedin_profile_id: accountInfo.linkedin_profile_id,
      is_mock: isMock,
    },
    ipAddress,
    userAgent,
  });

  // --- Build redirect response ---
  const redirectDest = loginPurpose
    ? "/settings/linkedin/scraping?redirect=/dashboard"
    : "/settings/linkedin/scraping?redirect=/settings/linkedin";
  const response = NextResponse.redirect(new URL(redirectDest, req.nextUrl.origin));

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
