import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const db = getServiceSupabase();

  const { data: users } = await db.from("users").select("id").limit(1);
  const userId = users?.[0]?.id;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: profile, error } = await db
    .from("style_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Style profile not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, profile }, { status: 200 });
}

export async function PUT(req: NextRequest) {
  const db = getServiceSupabase();

  const { data: users } = await db.from("users").select("id").limit(1);
  const userId = users?.[0]?.id;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const { style_json, user_confirmed, sample_post } = body;

    const { data: profile, error } = await db
      .from("style_profiles")
      .upsert({
        user_id: userId,
        style_json,
        user_confirmed: user_confirmed ?? true,
        sample_post,
        last_analyzed_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, profile }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
