import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

  try {
    const body = await req.json();
    const { scheduled_at } = body; // Optional date/time string

    const { data: users } = await db.from("users").select("id").limit(1);
    const userId = users?.[0]?.id;

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: any = {
      status: scheduled_at ? "scheduled" : "approved",
      updated_at: new Date().toISOString(),
    };

    if (scheduled_at) {
      updates.scheduled_at = new Date(scheduled_at).toISOString();
    }

    const { data: post, error } = await db
      .from("posts")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !post) {
      return NextResponse.json({ error: "Post not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ success: true, post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
