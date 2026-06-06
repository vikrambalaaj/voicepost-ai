import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
  }

  // Find active user
  const { data: users } = await db.from("users").select("id").limit(1);
  const userId = users?.[0]?.id;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Fetch post details
  const { data: post, error: postErr } = await db
    .from("posts")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (postErr || !post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Fetch revisions
  const { data: revisions } = await db
    .from("post_revisions")
    .select("*")
    .eq("post_id", id)
    .order("revision_number", { ascending: false });

  // Fetch images
  const { data: images } = await db
    .from("post_images")
    .select("*")
    .eq("post_id", id)
    .order("created_at", { ascending: false });

  // Fetch voice recording info
  const { data: voiceRecordings } = await db
    .from("voice_recordings")
    .select("duration_seconds, transcription_provider")
    .eq("post_id", id)
    .limit(1);

  return NextResponse.json({
    success: true,
    post,
    revisions: revisions || [],
    images: images || [],
    voice: voiceRecordings?.[0] || null,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

  try {
    const body = await req.json();
    const { image_url, source_type, prompt_used } = body;

    if (!image_url) {
      return NextResponse.json({ error: "image_url is required" }, { status: 400 });
    }

    // Insert image into post_images
    const { data: newImage, error: imgErr } = await db
      .from("post_images")
      .insert({
        post_id: id,
        source_type: source_type || "search",
        url: image_url,
        prompt_used: prompt_used || null,
        is_selected: true,
      })
      .select()
      .single();

    if (imgErr) {
      return NextResponse.json({ error: imgErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, image: newImage });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
