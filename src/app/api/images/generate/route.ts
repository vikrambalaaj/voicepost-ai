import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const db = getServiceSupabase();

  try {
    const body = await req.json();
    const { post_id, post_content, style, aspect_ratio, brand_colors, composition } = body;

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
    const selectedStyle = style || "editorial";
    const selectedRatio = aspect_ratio || "16:9";
    const selectedComposition = composition || "contrast";
    const colors = Array.isArray(brand_colors) && brand_colors.length > 0
      ? brand_colors.join(", ")
      : "deep navy, cool white, and a single warm gold accent";

    let styleInstruction = "Shot in the style of high-end business editorial photography reminiscent of Bloomberg, The Wall Street Journal, and Harvard Business Review — clean, intentional, and sophisticated.";
    let settingOption = "[a minimal modern desk / a clean abstract studio space / a blurred corporate office]";
    let lightingOption = "[soft cool blue-white / warm directional amber / high-contrast split lighting]";
    let moodOption = "[stark and aspirational / calm and authoritative / urgent]";
    let bgOption = "[deep charcoal / pure white / softly blurred]";

    if (selectedStyle === "3d") {
      styleInstruction = "Shot style: 3D render in the style of minimalist tech assets, frosted glassmorphism, claymorphism, futuristic tech objects. Rendered in a high-end 3D engine like Blender, smooth textures, ray-traced shadows, clean focus.";
      settingOption = "a clean abstract studio space with minimalist pedestals";
      bgOption = "clean pastel background or soft studio gray";
    } else if (selectedStyle === "vector") {
      styleInstruction = "Shot style: High-end minimalist vector illustration, flat design, clean geometric paths, sharp branding graphics. Reminiscent of modern corporate editorial illustrations, clean, sophisticated, and vector-aligned.";
      settingOption = "a clean vector grid background";
      bgOption = "solid clean background color";
    } else if (selectedStyle === "cyberpunk") {
      styleInstruction = "Shot style: Cinematic cyberpunk visual style, moody neon highlights, high contrast shadows. Shot on a full-frame camera with a 50mm lens, shallow depth of field, ultra-sharp focus on the key objects.";
      lightingOption = "strong neon highlights (electric blue, hot pink, or purple), high-contrast shadows";
      bgOption = "dark neon-drenched background or deep pitch-black";
    }

    let templateText = "";
    if (selectedComposition === "hero") {
      templateText = `A photorealistic editorial photograph illustrating [CORE THEME]. The composition focuses on a single surreal hero object: [HERO OBJECT DESCRIPTION] as the main focal point, representing [what it symbolizes]. The scene is set in ${settingOption}. [No people in frame / a single person photographed from behind / only hands visible interacting with the object]. The lighting is ${lightingOption}, creating a ${moodOption} mood against a ${bgOption} background. The color palette is restrained, built around ${colors}. ${styleInstruction} Captured on a full-frame camera with a 50mm lens, shallow depth of field, ultra-sharp focus on the key object, high dynamic range. No text, no logos, no charts, no infographics, no clip-art. Aspect ratio [${selectedRatio}]`;
    } else if (selectedComposition === "flatlay") {
      templateText = `An overhead flat-lay photograph illustrating [CORE THEME], shot from a top-down bird's-eye perspective. On a clean workspace surface, [2-3 symbolic objects] are arranged neatly and deliberately as the focal point, representing [how they embody the message]. The scene is set on ${settingOption}. [No people in frame / only hands visible interacting with the objects]. The lighting is ${lightingOption}, creating a ${moodOption} mood against a ${bgOption} background. The color palette is restrained, built around ${colors}. ${styleInstruction} Captured on a full-frame camera, ultra-sharp focus, high dynamic range. No text, no logos, no charts, no infographics, no clip-art. Aspect ratio [${selectedRatio}]`;
    } else {
      // default: contrast
      templateText = `A photorealistic editorial photograph illustrating [CORE THEME]. The composition uses a clear visual contrast between [OLD STATE / PROBLEM] on the left and [NEW STATE / SOLUTION] on the right. The scene is set in ${settingOption}. In the frame, [2–3 symbolic objects] are arranged deliberately as the focal point, [describe how they embody the message]. [No people in frame / a single person photographed from behind / only hands visible interacting with the objects]. The lighting is ${lightingOption}, creating a ${moodOption} mood against a ${bgOption} background. The color palette is restrained, built around ${colors}. ${styleInstruction} Captured on a full-frame camera with a 50mm lens, shallow depth of field, ultra-sharp focus on the key objects, high dynamic range. No text, no logos, no charts, no infographics, no clip-art. Aspect ratio [${selectedRatio}]`;
    }

    let fluxPrompt = "";
    try {
      const promptGeneratorInstruction = `You are a creative director who generates high-end visual prompts for AI image generation (Flux model).
Analyze the following LinkedIn post content and output a filled-out visual prompt based on the template below.

CRITICAL INSTRUCTIONS:
- First, identify the core theme of the post. If the post mentions specific technical terms, enterprise plans, or software (like "SAP Max Plan", "EAM", "Datasphere", "Snowflake"), translate them into clear, high-level visual concepts (e.g. "enterprise support scaling", "data synchronization", "database optimization").
- Make the visual prompt abstract, conceptual, and premium. Avoid drawing literal software menus, charts, screenshots, or corporate logos.
- Read and analyze the post to identify the core theme, the old state/problem, new state/solution, or key symbolic objects based on the chosen composition.
- Replace the brackets like [CORE THEME], [OLD STATE / PROBLEM], [NEW STATE / SOLUTION], [HERO OBJECT DESCRIPTION], [2-3 symbolic objects], [describe how they embody the message], etc., with the filled-out values.
- Make sure to select the most appropriate options inside brackets (e.g. choose between the options provided or use the specified value).
- The output must be a single cohesive paragraph matching the template exactly. Do not include any bullet points, lists, or markdown.

OUTPUT FORMAT:
Return ONLY the filled-in template text. No conversational preamble, no markdown backticks, no extra text.

TEMPLATE TO FILL IN:
${templateText}`;

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

      fluxPrompt = llmRes.content.trim().replace(/^`+|`+$/g, "").trim().replace(/\*/g, "");
    } catch (err) {
      console.warn("Failed to generate custom visual metaphor prompt, falling back.", err);
    }

    if (!fluxPrompt) {
      // Fallback filled-in prompt
      if (selectedComposition === "hero") {
        fluxPrompt = `A photorealistic editorial photograph illustrating professional growth. The composition focuses on a single surreal hero object: a glowing glass lightbulb growing fresh green plant roots from its base as the main focal point, representing innovative ideas taking root. The scene is set in a minimal modern desk. No people in frame. The lighting is soft cool blue-white, creating a stark and aspirational mood against a deep charcoal background. The color palette is restrained, built around deep navy, cool white, and a single warm gold accent. Shot in the style of high-end business editorial photography reminiscent of Bloomberg — clean, intentional, and sophisticated. Captured on a full-frame camera with a 50mm lens, shallow depth of field, ultra-sharp focus on the key object, high dynamic range. No text, no logos, no charts, no infographics, no clip-art. Aspect ratio [${selectedRatio}]`;
      } else if (selectedComposition === "flatlay") {
        fluxPrompt = `An overhead flat-lay photograph illustrating professional organization, shot from a top-down bird's-eye perspective. On a clean workspace surface, a sleek modern tablet, a minimalist leather notebook, and a designer pen are arranged neatly and deliberately as the focal point, representing digital efficiency. The scene is set on a minimal modern desk. No people in frame. The lighting is soft cool blue-white, creating a stark and aspirational mood against a deep charcoal background. The color palette is restrained, built around deep navy, cool white, and a single warm gold accent. Shot in the style of high-end business editorial photography reminiscent of Bloomberg — clean, intentional, and sophisticated. Captured on a full-frame camera, ultra-sharp focus, high dynamic range. No text, no logos, no charts, no infographics, no clip-art. Aspect ratio [${selectedRatio}]`;
      } else {
        fluxPrompt = `A photorealistic editorial photograph illustrating professional growth. The composition uses a clear visual contrast between a chaotic stack of papers on the left and a single clean tablet on the right. The scene is set in a minimal modern desk. In the frame, the stack of papers and the tablet are arranged deliberately as the focal point, symbolizing the transition from old clutter to digital simplicity. No people in frame. The lighting is soft cool blue-white, creating a stark and aspirational mood against a deep charcoal background. The color palette is restrained, built around deep navy, cool white, and a single warm gold accent. Shot in the style of high-end business editorial photography reminiscent of Bloomberg, The Wall Street Journal, and Harvard Business Review — clean, intentional, and sophisticated. Captured on a full-frame camera with a 50mm lens, shallow depth of field, ultra-sharp focus on the key objects, high dynamic range. No text, no logos, no charts, no infographics, no clip-art. Aspect ratio [${selectedRatio}]`;
      }
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
              aspect_ratio: selectedRatio === "4:5" ? "4:5" : (selectedRatio === "1:1" ? "1:1" : "16:9"),
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

    // 3b. Try Hugging Face Inference API if token is configured
    const hfToken = process.env.HUGGINGFACE_API_KEY || process.env.HF_ACCESS_TOKEN || process.env.HF_API_KEY;
    if (!generatedImageUrl && hfToken) {
      try {
        console.log("[images/generate] Replicate failed or not configured. Trying Hugging Face FLUX.1-schnell...");
        const hfRes = await fetch("https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: fluxPrompt }),
        });

        if (hfRes.ok) {
          const buffer = await hfRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = hfRes.headers.get("content-type") || "image/jpeg";
          generatedImageUrl = `data:${contentType};base64,${base64}`;
          providerUsed = "FLUX.1-schnell (Hugging Face)";
          console.log("[images/generate] Successfully generated image via Hugging Face!");
        } else {
          const errMsg = await hfRes.text();
          console.warn(`[images/generate] Hugging Face generation failed: ${hfRes.status} ${errMsg}`);
        }
      } catch (hfErr: any) {
        console.error("[images/generate] Hugging Face generation error:", hfErr.message);
      }
    }

    // 3c. Try Pollinations.ai as a keyless, free fallback
    if (!generatedImageUrl) {
      try {
        console.log("[images/generate] Trying Pollinations.ai FLUX (keyless free option)...");
        // Format prompt for URL
        const cleanedPrompt = fluxPrompt
          .replace(/[\r\n]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        
        let width = 1024;
        let height = 576;
        if (selectedRatio === "1:1") {
          width = 1024;
          height = 1024;
        } else if (selectedRatio === "4:5") {
          width = 800;
          height = 1000;
        }
        
        const pollinationUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanedPrompt)}?width=${width}&height=${height}&model=flux&nologo=true&private=true`;
        
        // We do a quick fetch to pre-trigger and cache the image on Pollinations' CDN
        const testRes = await fetch(pollinationUrl);
        if (testRes.ok) {
          generatedImageUrl = pollinationUrl;
          providerUsed = "FLUX (Pollinations.ai)";
          console.log("[images/generate] Successfully generated/cached image via Pollinations.ai!");
        } else {
          console.warn(`[images/generate] Pollinations.ai ping failed: ${testRes.status}`);
        }
      } catch (pollinationErr: any) {
        console.error("[images/generate] Pollinations.ai generation error:", pollinationErr.message);
      }
    }

    // Check if image generation succeeded (including Hugging Face and Pollinations.ai)
    if (!generatedImageUrl) {
      try {
        console.log("[images/generate] All AI generators failed or not configured. Fetching dynamic search image...");
        
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
