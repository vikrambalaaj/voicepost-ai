import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { post_id, post_content } = body;

    if (!post_id || !post_content) {
      return NextResponse.json({ error: "post_id and post_content are required" }, { status: 400 });
    }

    // 1. Fetch user to check quotas and plans
    const userId = await getAuthenticatedUserId(req);
    let user: any = null;
    if (userId) {
      const { data } = await db.from("users").select("id, plan, ai_images_used_this_week, ai_images_limit_weekly").eq("id", userId).single();
      user = data;
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check plan quotas
    if (user.plan === "free" && user.ai_images_used_this_week >= (user.ai_images_limit_weekly || 3)) {
      return NextResponse.json({ quota_hit: true, error: "AI image limit reached. Upgrade to generate more images." }, { status: 403 });
    }

    // 2. Extract visual theme using LLM router
    let visualTheme = "modern office desk setup with laptops and plants";
    try {
      const keywordPrompt = `Extract a single, concise visual theme or concept from this LinkedIn post that would make a great professional photographic background. 
Return only the description of the visual theme in 4-6 words. No quotes, no preamble.

POST CONTENT:
"${post_content}"`;

      const llmRes = await routeLLMRequest({
        useCase: "keyword_extraction",
        messages: [{ role: "user", content: keywordPrompt }],
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "image-keywords-" + Date.now(),
      });

      visualTheme = llmRes.content.trim().replace(/^"|"$/g, "");
    } catch (err) {
      console.warn("Failed to extract visual theme, using default.");
    }

    const fluxPrompt = `Professional LinkedIn photo: ${visualTheme}. Clean modern aesthetic, natural lighting, no text, photorealistic.`;

    let generatedImageUrl = "";
    let providerUsed = "MockFLUX";

    const replicateToken = process.env.REPLICATE_API_TOKEN;

    // 3. Trigger Replicate FLUX.1-schnell and return predictionId for client-side polling
    if (replicateToken) {
      try {
        const triggerResponse = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: {
            Authorization: `Token ${replicateToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            version: "0bc9e115e3474d2fa81691a3203923d240dca1918ed9b31d87455d3f82e5b90f",
            input: {
              prompt: fluxPrompt,
              num_outputs: 1,
              aspect_ratio: "16:9",
              output_format: "webp",
              output_quality: 80,
            },
          }),
        });

        if (triggerResponse.ok) {
          const prediction = await triggerResponse.json();
          // Return predictionId immediately — client polls /api/images/status?id=...
          return NextResponse.json({
            success: true,
            prediction_id: prediction.id,
            poll_url: prediction.urls?.get,
            status: "processing",
            post_id,
            prompt: fluxPrompt,
          });
        }
      } catch (err: any) {
        console.error("Replicate FLUX trigger failed:", err.message);
      }
    }

    // Check if image generation succeeded
    if (!generatedImageUrl) {
      const mockImages = [
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop"
      ];
      const randIdx = Math.floor(Math.random() * mockImages.length);
      generatedImageUrl = mockImages[randIdx];
      providerUsed = "MockFLUX (Fallback)";
      console.warn("REPLICATE_API_TOKEN is missing. Using fallback mock image: " + generatedImageUrl);
    }

    let returnedImageId = "temp_ai_" + Date.now();

    if (post_id === "00000000-0000-0000-0000-000000000000") {
      console.log("Bypassing database insert for dummy post_id");
    } else {
      // 5. Save generated image to post_images (RLS protected)
      const { data: newImage, error: imgErr } = await db.from("post_images").insert({
        post_id,
        source_type: "ai",
        url: generatedImageUrl,
        prompt_used: fluxPrompt,
        is_selected: false,
      }).select().single();

      if (imgErr) throw imgErr;
      returnedImageId = newImage.id;
    }

    // Increment AI images used counter
    if (user.plan === "free") {
      await db.from("users")
        .update({ ai_images_used_this_week: user.ai_images_used_this_week + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json({
      success: true,
      image: {
        id: returnedImageId,
        url: generatedImageUrl,
        prompt: fluxPrompt,
        provider: providerUsed,
      }
    });

  } catch (error: any) {
    console.error("Failed to generate AI image:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
