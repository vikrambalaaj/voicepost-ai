import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";
import { sendApprovalEmailInternal } from "@/lib/email";

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
  const userId = await getAuthenticatedUserId(req);

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
    const { post_content, hashtags, status, image_url, source_type, prompt_used } = body;

    // Find active user
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify post ownership
    const { data: postExists, error: postErr } = await db
      .from("posts")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (postErr || !postExists) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // If updating post columns
    if (post_content !== undefined || hashtags !== undefined || status !== undefined) {
      // 1. Fetch current post
      const { data: existingPost } = await db
        .from("posts")
        .select("status, current_revision, post_content, hashtags")
        .eq("id", id)
        .eq("user_id", userId)
        .single();

      if (!existingPost) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      const updateData: any = {};
      let isContentChanged = false;

      if (post_content !== undefined && post_content !== existingPost.post_content) {
        updateData.post_content = post_content;
        isContentChanged = true;
      }
      if (hashtags !== undefined && JSON.stringify(hashtags) !== JSON.stringify(existingPost.hashtags)) {
        updateData.hashtags = hashtags;
        isContentChanged = true;
      }
      if (status !== undefined) {
        updateData.status = status;
      }

      let nextRevisionNum = existingPost.current_revision || 1;

      if (isContentChanged) {
        nextRevisionNum = nextRevisionNum + 1;
        updateData.current_revision = nextRevisionNum;
      }

      const { data: updatedPost, error: updateErr } = await db
        .from("posts")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      // If content changed, save a new revision row
      if (isContentChanged) {
        await db.from("post_revisions").insert({
          post_id: id,
          revision_number: nextRevisionNum,
          post_content: updateData.post_content !== undefined ? updateData.post_content : existingPost.post_content,
          hashtags: updateData.hashtags !== undefined ? updateData.hashtags : existingPost.hashtags,
          feedback_given: "Manual edit",
          changes_made: ["Manual edits"],
        });
      }

      // If status is updated to pending_approval, and it wasn't before
      if (status === "pending_approval" && existingPost?.status !== "pending_approval") {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
          await sendApprovalEmailInternal({
            post_id: updatedPost.id,
            post_content: updatedPost.post_content,
            hashtags: updatedPost.hashtags || [],
            baseUrl,
          });
        } catch (emailErr) {
          console.warn("[posts/[id]/route] Email notification failed (non-blocking):", emailErr);
        }
      }

      return NextResponse.json({ success: true, post: updatedPost });
    }

    // Otherwise, attach image to post (backward compatibility)
    if (!image_url) {
      return NextResponse.json({ error: "image_url, post_content, hashtags, or status is required" }, { status: 400 });
    }

    // Check if the image url is already attached to this post
    const { data: existingImg } = await db
      .from("post_images")
      .select("id")
      .eq("post_id", id)
      .eq("url", image_url)
      .limit(1);

    let imageResult;
    if (existingImg && existingImg.length > 0) {
      // Just update it to be selected
      const { data: updatedImg, error: imgErr } = await db
        .from("post_images")
        .update({ is_selected: true })
        .eq("id", existingImg[0].id)
        .select()
        .single();
      if (imgErr) {
        return NextResponse.json({ error: imgErr.message }, { status: 500 });
      }
      imageResult = updatedImg;
    } else {
      // Insert new image
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
      imageResult = newImage;
    }

    return NextResponse.json({ success: true, image: imageResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


