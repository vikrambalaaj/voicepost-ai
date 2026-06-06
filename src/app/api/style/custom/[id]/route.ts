import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getServiceSupabase();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: "Style ID is required" }, { status: 400 });
  }

  // Find active user
  const { data: users } = await db.from("users").select("id").limit(1);
  const userId = users?.[0]?.id;

  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await db
    .from("custom_styles")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Custom style deleted successfully" }, { status: 200 });
}
