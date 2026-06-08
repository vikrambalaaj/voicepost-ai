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

    // 2. Extract visual theme using LLM router and generate detailed metaphor prompt
    let fluxPrompt = "";
    try {
      const promptGeneratorInstruction = `You are a creative director who generates high-end visual prompts for AI image generation (Flux model).
Analyze the following LinkedIn post content and output a filled-out visual prompt based on the template below.

TEMPLATE RULES:
- Fill in the values in brackets [] based on the core message and themes of the post.
- Create a compelling, creative visual metaphor (e.g. old way vs new way, complexity vs simplicity, chaos vs control).
- Keep the scene simple: focus on 2-3 key objects, left side represents the problem/old state, right side represents the solution/new state.
- Keep the style strictly professional editorial (Bloomberg/WSJ/HBR style). No cartoonish or stock-photo feel.

OUTPUT FORMAT:
Return ONLY the filled-in template text. No conversational preamble, no markdown backticks, no extra text.

TEMPLATE TO FILL IN:
Photorealistic editorial-style image representing the concept of [CORE THEME OF YOUR ARTICLE].

VISUAL METAPHOR:
[Describe the main contrast or idea visually — e.g. "old way vs new way", "complexity vs simplicity", "expensive vs affordable", "chaos vs control"]

SCENE SETUP:
- Setting: [Minimal desk / Office / Abstract space / Urban environment]
- Key objects in frame: [2–3 objects that represent your article's message]
- Left side of frame: [Represents the problem or old state]
- Right side of frame: [Represents the solution or new state]
- No people / One person from behind / Hands only

MOOD & LIGHTING:
- Overall mood: [Stark / Aspirational / Urgent / Clean]
- Light source: [Cool blue-white / Warm amber / High contrast split lighting]
- Background: [Deep charcoal / Pure white / Blurred office environment]

COLOR PALETTE:
- Primary: [e.g. Deep navy, cool white]
- Accent: [e.g. Warm gold, electric blue]
- Avoid: Bright colors, gradients, stock-photo feel

STYLE REFERENCE:
- Shot style: [Bloomberg / WSJ / HBR editorial photography]
- No text overlays, no infographics, no clip-art
- Ultra high resolution, sharp focus on [KEY OBJECT]
- Aspect ratio: 16:9 for LinkedIn banner / 1:1 for post / 4:5 for mobile feed`;

      const llmRes = await routeLLMRequest({
        useCase: "keyword_extraction",
        messages: [
          { role: "system", content: promptGeneratorInstruction },
          { role: "user", content: `POST CONTENT:\n"${post_content}"` }
        ],
        userId: user.id,
        userPlan: user.plan as any,
        sessionId: "image-prompt-generation-" + Date.now(),
      });

      fluxPrompt = llmRes.content.trim().replace(/^`+|`+$/g, "").trim();
    } catch (err) {
      console.warn("Failed to generate custom visual metaphor prompt, falling back.", err);
    }

    if (!fluxPrompt) {
      // Fallback filled-in prompt
      fluxPrompt = `Photorealistic editorial-style image representing the concept of professional growth.

VISUAL METAPHOR:
Complexity vs simplicity.

SCENE SETUP:
- Setting: Minimal desk
- Key objects in frame: A simple notebook and a complex stack of wires
- Left side of frame: Represents chaos and complexity
- Right side of frame: Represents order and simplicity
- No people

MOOD & LIGHTING:
- Overall mood: Clean and aspirational
- Light source: High contrast split lighting
- Background: Deep charcoal

COLOR PALETTE:
- Primary: Deep navy, cool white
- Accent: Warm gold
- Avoid: Bright colors, gradients, stock-photo feel

STYLE REFERENCE:
- Shot style: HBR editorial photography
- No text overlays, no infographics, no clip-art
- Ultra high resolution, sharp focus on the notebook
- Aspect ratio: 16:9 for LinkedIn banner`;
    }

    let generatedImageUrl = "";
    let providerUsed = "MockFLUX";

    const replicateToken = process.env.REPLICATE_API_TOKEN;

    // 3. Trigger Replicate FLUX.1-schnell and poll until completion
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
          const predictionId = prediction.id;
          let predictionStatus = prediction.status;
          let predictionOutput = null;
          let attempts = 0;
          const maxAttempts = 5;

          while (
            (predictionStatus === "starting" || predictionStatus === "processing") &&
            attempts < maxAttempts
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            attempts++;

            try {
              const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
                headers: {
                  Authorization: `Token ${replicateToken}`,
                },
              });
              if (pollResponse.ok) {
                const pollData = await pollResponse.json();
                predictionStatus = pollData.status;
                predictionOutput = pollData.output;
                console.log(`[Replicate Poll] Attempt ${attempts}: status is ${predictionStatus}`);
              }
            } catch (pollErr) {
              console.error("[Replicate Poll] Error polling prediction:", pollErr);
            }
          }

          if (predictionStatus === "succeeded" && predictionOutput) {
            const outputUrl = Array.isArray(predictionOutput) ? predictionOutput[0] : predictionOutput;
            if (outputUrl) {
              generatedImageUrl = outputUrl;
              providerUsed = "FLUX.1-schnell (Replicate)";
            }
          } else {
            console.warn(`[Replicate Poll] Prediction did not succeed. Status: ${predictionStatus}`);
          }
        }
      } catch (err: any) {
        console.error("Replicate FLUX trigger/poll failed:", err.message);
      }
    }

    // Check if image generation succeeded
    if (!generatedImageUrl) {
      try {
        console.log("[images/generate] Replicate token missing or generation failed. Fetching dynamic search image...");
        
        // 1. Extract a visual search query (2-3 words)
        const searchKeywordPrompt = `Analyze the following LinkedIn post and extract a 2-3 word visual search query to find a matching symbolic editorial photo on Unsplash (e.g. "growing graph", "puzzle piece", "clean desk", "group meeting").
POST CONTENT:
"${post_content}"

Return ONLY the 2-3 words. No preamble, no quotes, no period.`;

        const searchKeywordRes = await routeLLMRequest({
          useCase: "keyword_extraction",
          messages: [{ role: "user", content: searchKeywordPrompt }],
          userId: user.id,
          userPlan: user.plan as any,
          sessionId: "image-search-keyword-" + Date.now(),
        });
        const searchQuery = searchKeywordRes.content.trim().replace(/['"“”]/g, "").trim() || "business startup";
        console.log(`[images/generate] Generated search query: "${searchQuery}"`);

        let foundImageUrl = "";

        // 2. Perform Tavily image search if API key exists
        const tavilyKey = process.env.TAVILY_API_KEY;
        if (tavilyKey) {
          try {
            console.log(`[images/generate] Searching Tavily for image: "${searchQuery}"`);
            const tavilyRes = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                api_key: tavilyKey,
                query: searchQuery,
                include_images: true,
                max_results: 5,
              }),
            });
            if (tavilyRes.ok) {
              const data = await tavilyRes.json();
              if (data.images && data.images.length > 0) {
                const img = data.images[0];
                foundImageUrl = typeof img === "string" ? img : img.url;
                providerUsed = `Dynamic Search (Tavily: "${searchQuery}")`;
                console.log(`[images/generate] Successfully fetched Tavily image: ${foundImageUrl}`);
              }
            }
          } catch (tavilyErr) {
            console.error("[images/generate] Tavily image search failed:", tavilyErr);
          }
        }

        // 3. Fallback to DuckDuckGo image search
        if (!foundImageUrl) {
          console.log(`[images/generate] Falling back to DuckDuckGo search for: "${searchQuery}"`);
          const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`;
          const htmlRes = await fetch(ddgUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"
            }
          });
          
          if (htmlRes.ok) {
            const html = await htmlRes.text();
            const vqdRegex = /vqd=['"]?([^'"]+)['"]?/;
            const match = html.match(vqdRegex);
            if (match) {
              const vqd = match[1];
              const imagesRes = await fetch(`https://duckduckgo.com/i.js?q=${encodeURIComponent(searchQuery)}&vqd=${vqd}&o=json`, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
                  "Referer": `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&iax=images&ia=images`
                }
              });
              if (imagesRes.ok) {
                const data = await imagesRes.json();
                if (data.results && data.results.length > 0) {
                  foundImageUrl = data.results[0].image;
                  providerUsed = `Dynamic Search (DuckDuckGo: "${searchQuery}")`;
                  console.log(`[images/generate] Successfully fetched DuckDuckGo image: ${foundImageUrl}`);
                }
              }
            }
          }
        }

        if (foundImageUrl) {
          generatedImageUrl = foundImageUrl;
        }
      } catch (err) {
        console.error("[images/generate] Dynamic search image fallback failed:", err);
      }
    }

    // Final hardcoded fallback if everything else fails
    if (!generatedImageUrl) {
      const mockImages = [
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1507537297725-24a1c029d3ca?w=800&auto=format&fit=crop"
      ];
      const randIdx = Math.floor(Math.random() * mockImages.length);
      generatedImageUrl = mockImages[randIdx];
      providerUsed = "MockFLUX (Fallback)";
      console.warn("REPLICATE_API_TOKEN is missing and search failed. Using fallback mock image: " + generatedImageUrl);
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
