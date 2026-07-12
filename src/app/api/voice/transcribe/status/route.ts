import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const transcriptId = req.nextUrl.searchParams.get("id");

  const userId = await getAuthenticatedUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;

  const durationSeconds = parseInt(req.nextUrl.searchParams.get("duration") || "30", 10);
  const industry = req.nextUrl.searchParams.get("industry") || "Professional";
  const keywordsRaw = req.nextUrl.searchParams.get("keywords") || "";
  const keywords = keywordsRaw ? keywordsRaw.split(",") : [];

  if (!transcriptId) {
    return NextResponse.json({ error: "transcript_id is required" }, { status: 400 });
  }

  const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;
  if (!assemblyAIKey) {
    return NextResponse.json({ error: "ASSEMBLYAI_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Single poll — no waiting loop (client calls this endpoint repeatedly)
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { Authorization: assemblyAIKey },
    });

    if (!pollRes.ok) {
      throw new Error(`AssemblyAI status poll failed: ${pollRes.status}`);
    }

    const pollData = await pollRes.json();

    if (pollData.status === "error") {
      return NextResponse.json({ status: "error", error: `Transcription failed: ${pollData.error}` }, { status: 500 });
    }

    if (pollData.status !== "completed") {
      // Still processing — client should poll again in 2s
      return NextResponse.json({ status: pollData.status });
    }

    // Completed — run LLM correction pass and return final transcript
    const rawTranscript = pollData.text || "";
    let correctedTranscript = rawTranscript;

    const db = getServiceSupabase();
    const userPlan = "pro"; // default; could look up user if needed

    try {
      const correctionPrompt = `You are an expert audio transcription editor. Correct any spelling, capitalization, grammar, or punctuation errors in the transcribed text below. 
Fix any industry-specific vocabulary or brand names that might have been misheard, based on:
Industry: "${industry}"
Keywords: "${keywords.join(", ")}"

Rules:
1. Do NOT rewrite the text into a post.
2. Keep the original wording, tone, and sentence structure. Just fix formatting, punctuation, and typos.
3. Return ONLY the edited transcript text. No preamble, no quotes, no conversational filler.

TRANSCRIPT:
"${rawTranscript}"`;

      const correctionRes = await routeLLMRequest({
        useCase: "transcript_correction",
        messages: [
          {
            role: "system",
            content: "You are a strict, automated transcript editing program. Output ONLY the corrected text. Never add any preamble, notes, explanations, markdown blocks, formatting, or conversational filler. If no edits are required, output the original text exactly."
          },
          { role: "user", content: correctionPrompt }
        ],
        userId,
        userPlan: userPlan as any,
        sessionId: "voice-status-" + transcriptId,
      });

      correctedTranscript = correctionRes.content.trim().replace(/^"|"$/g, "");
    } catch (err: any) {
      console.warn("LLM transcript correction failed, returning raw transcript:", err.message);
    }

    // Store in voice_recordings
    try {
      await db.from("voice_recordings").insert({
        user_id: userId,
        storage_path: "recordings/audio_" + Date.now() + ".webm",
        duration_seconds: durationSeconds,
        transcript_raw: rawTranscript,
        transcript_corrected: correctedTranscript,
        transcription_provider: "AssemblyAI",
        latency_ms: 0,
      });

      // Log voice transcription audit event
      await logAuditEvent({
        userId,
        action: "VOICE_TRANSCRIBED",
        targetType: "voice_recording",
        details: {
          duration_seconds: durationSeconds,
          provider: "AssemblyAI",
          raw_transcript_length: rawTranscript.length,
          corrected_transcript_length: correctedTranscript.length,
        },
        ipAddress,
        userAgent,
      });
    } catch (dbErr) {
      console.warn("Failed to store voice recording:", dbErr);
    }

    return NextResponse.json({
      status: "completed",
      raw_transcript: rawTranscript,
      corrected_transcript: correctedTranscript,
      duration_seconds: durationSeconds,
    });

  } catch (error: any) {
    console.error("Status poll failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
