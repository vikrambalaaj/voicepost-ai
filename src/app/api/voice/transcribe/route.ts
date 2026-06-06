import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  // Find user
  const userId = await getAuthenticatedUserId(req);
  let user: any = null;
  if (userId) {
    const { data } = await db.from("users").select("id, industry, keywords, plan").eq("id", userId).single();
    user = data;
  }
  if (!user) {
    user = {
      id: "00000000-0000-0000-0000-000000000000",
      industry: "SaaS & Creators",
      keywords: ["building in public", "solopreneur"],
      plan: "pro",
    };
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as Blob;
    const durationStr = formData.get("duration") as string;
    const durationSeconds = durationStr ? parseInt(durationStr, 10) : 30;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    let rawTranscript = "";
    let providerUsed = "AssemblyAI";

    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;
    const startTime = Date.now();

    if (!assemblyAIKey) {
      return NextResponse.json(
        { error: "ASSEMBLYAI_API_KEY is not configured in your environment variables." },
        { status: 400 }
      );
    }

    try {
      // 1. Upload audio file to AssemblyAI
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

      // 2. Submit transcription request
      const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
          Authorization: assemblyAIKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          speech_models: ["universal-3-pro", "universal-2"],
          language_detection: true,
          keyterms_prompt: user.keywords || [],
        }),
      });

      if (!transcriptRes.ok) {
        throw new Error(`AssemblyAI transcription request failed: ${transcriptRes.status} ${transcriptRes.statusText}`);
      }

      const transcriptData = await transcriptRes.json();
      const transcriptId = transcriptData.id;

      // 3. Poll for the result
      const maxPollAttempts = 45; // up to 45 seconds max
      let completedData = null;
      for (let i = 0; i < maxPollAttempts; i++) {
        const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: {
            Authorization: assemblyAIKey,
          },
        });
        if (!pollRes.ok) {
          throw new Error(`AssemblyAI status poll failed: ${pollRes.status} ${pollRes.statusText}`);
        }
        const pollData = await pollRes.json();
        if (pollData.status === "completed") {
          completedData = pollData;
          break;
        } else if (pollData.status === "error") {
          throw new Error(`AssemblyAI transcription failed: ${pollData.error}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!completedData || completedData.status !== "completed") {
        throw new Error("AssemblyAI transcription timed out");
      }

      rawTranscript = completedData.text;
      providerUsed = "AssemblyAI Universal-3 Pro";
    } catch (err: any) {
      console.error("AssemblyAI transcription failed:", err.message);
      return NextResponse.json({ error: `Transcription failed: ${err.message}` }, { status: 500 });
    }

    // 2. Second Pass: LLM Transcript Correction
    let correctedTranscript = rawTranscript;
    try {
      const correctionPrompt = `You are an expert audio transcription editor. Correct any spelling, capitalization, grammar, or punctuation errors in the transcribed text below. 
Fix any industry-specific vocabulary or brand names that might have been misheard, based on:
Industry: "${user.industry}"
Keywords: "${user.keywords?.join(", ")}"

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
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "voice-transcribe-" + Date.now(),
      });

      correctedTranscript = correctionRes.content.trim().replace(/^"|"$/g, "");
    } catch (err: any) {
      console.warn("LLM transcript correction failed, returning raw transcript:", err.message);
    }

    const latencyMs = Date.now() - startTime;

    // 3. Store in voice_recordings (RLS enforced)
    await db.from("voice_recordings").insert({
      user_id: user.id,
      storage_path: "recordings/audio_" + Date.now() + ".webm",
      duration_seconds: durationSeconds,
      transcript_raw: rawTranscript,
      transcript_corrected: correctedTranscript,
      transcription_provider: providerUsed,
      latency_ms: latencyMs,
    });

    return NextResponse.json({
      raw_transcript: rawTranscript,
      corrected_transcript: correctedTranscript,
      duration_seconds: durationSeconds,
      provider: providerUsed,
      latencyMs,
    });
  } catch (error: any) {
    console.error("Failed to transcribe:", error);
    return NextResponse.json({ error: "Failed to transcribe: " + error.message }, { status: 500 });
  }
}
