import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  // Find active user
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get active account
  const { data: accounts } = await db
    .from("linkedin_accounts")
    .select("scraping_status, posts_scraped_count, profile_name, profile_picture_url, profile_email, linkedin_profile_id, profile_headline")
    .eq("user_id", userId)
    .eq("is_primary", true);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  }

  const account = accounts[0];

  // Get style profile if exists to return detected traits
  const { data: styleProfiles } = await db
    .from("style_profiles")
    .select("style_json")
    .eq("user_id", userId);

  const styleProfile = styleProfiles?.[0];
  const styleTraits = styleProfile
    ? [
        styleProfile.style_json.tone_descriptor,
        `${styleProfile.style_json.avg_post_length_words} words avg`,
        styleProfile.style_json.sentence_length_pattern,
        styleProfile.style_json.cta_style,
      ].filter(Boolean)
    : [];

  return NextResponse.json(
    {
      status: account.scraping_status,
      posts_scraped: account.posts_scraped_count,
      profile_name: account.profile_name,
      profile_headline: account.profile_headline || null,
      profile_picture_url: account.profile_picture_url || null,
      profile_email: account.profile_email || null,
      // Construct LinkedIn profile URL from the stored urn (e.g. "urn:li:person:AbCdEfGh")
      linkedin_profile_url: account.linkedin_profile_id
        ? `https://www.linkedin.com/in/${account.linkedin_profile_id.replace("urn:li:person:", "")}`
        : null,
      style_traits: styleTraits,
      total_estimated: 5,
    },
    { status: 200 }
  );
}
