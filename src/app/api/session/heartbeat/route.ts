import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { session_id } = body;

    if (session_id) {
      await db
        .from("user_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", session_id);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
