import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getAuthenticatedUserId } from "@/lib/auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  // Find user
  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await db.from("users").select("id, industry, keywords, plan").eq("id", userId).single();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;
    const durationStr = formData.get("duration") as string;
    const durationSeconds = durationStr ? parseInt(durationStr, 10) : 30;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;

    if (!assemblyAIKey) {
      return NextResponse.json(
        { error: "ASSEMBLYAI_API_KEY is not configured in your environment variables." },
        { status: 400 }
      );
    }

    // Step 1: Upload audio file to AssemblyAI (~1-2s)
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        Authorization: assemblyAIKey,
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!uploadRes.ok) {
      throw new Error(`AssemblyAI upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
    }

    const uploadData = await uploadRes.json();
    const audioUrl = uploadData.upload_url;

    // Step 2: Submit transcription request (~0.5s) — return transcript_id immediately
    // The client will poll /api/voice/transcribe/status?id=<transcript_id> until complete.
    const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: assemblyAIKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_detection: true,
        keyterms_prompt: user.keywords || [],
      }),
    });

    if (!transcriptRes.ok) {
      throw new Error(`AssemblyAI transcription request failed: ${transcriptRes.status} ${transcriptRes.statusText}`);
    }

    const transcriptData = await transcriptRes.json();

    // Return transcript_id immediately — client polls /api/voice/transcribe/status
    return NextResponse.json({
      transcript_id: transcriptData.id,
      status: "processing",
      duration_seconds: durationSeconds,
      user_id: user.id,
      industry: user.industry,
      keywords: user.keywords,
    });
  } catch (error: any) {
    console.error("Failed to submit transcription:", error);
    return NextResponse.json({ error: "Failed to submit transcription: " + error.message }, { status: 500 });
  }
}
