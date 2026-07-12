import { getEligibleProviders, PROVIDERS, ProviderConfig } from "../providers/registry";
import { getServiceSupabase } from "../supabase";

export interface LLMRequest {
  useCase: "content_generation" | "style_analysis" | "regeneration" | "transcript_correction" | "keyword_extraction" | "style_preview" | "trend_analysis";
  messages: { role: string; content: string }[];
  userId: string;
  userPlan: "free" | "starter" | "pro" | "agency";
  sessionId: string;
  preferredProviderId?: string;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  enableSearch?: boolean;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  fallbackChain: string[];
}

export class LLMExhaustedError extends Error {
  constructor(message = "Our AI needs a moment. Please try again in a few minutes.") {
    super(message);
    this.name = "LLMExhaustedError";
  }
}

// Timeout helper
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout of ${timeoutMs}ms exceeded`));
    }, timeoutMs);

    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function routeLLMRequest(request: LLMRequest): Promise<LLMResponse> {
  const db = getServiceSupabase();
  const dateStr = new Date().toISOString().split("T")[0];

  // 1. Get eligible providers (static list first)
  const planToUse = request.useCase === "keyword_extraction" ? "pro" : request.userPlan;
  let eligibleProviders = getEligibleProviders(planToUse);

  // Load database configurations if available
  const dailyLimitOverrides = new Map<string, number>();
  const modelOverrides = new Map<string, string>();

  try {
    const { data: dbConfigs } = await db
      .from("provider_configs")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: true });

    if (dbConfigs && dbConfigs.length > 0) {
      // Re-map eligibleProviders based on database priority & status
      dbConfigs.forEach((cfg: any) => {
        if (cfg.daily_limit_override !== null && cfg.daily_limit_override !== undefined) {
          dailyLimitOverrides.set(cfg.id, cfg.daily_limit_override);
        }
        const model =
          planToUse === "free"
            ? cfg.model_free
            : planToUse === "starter"
            ? cfg.model_starter
            : planToUse === "pro"
            ? cfg.model_pro
            : cfg.model_agency;
        if (model) {
          modelOverrides.set(cfg.id, model);
        }
      });

      // Construct merged list from active DB configs
      const merged: ProviderConfig[] = dbConfigs.map((cfg: any) => {
        const stdReg = PROVIDERS[cfg.id];
        return {
          id: cfg.id,
          name: cfg.name,
          baseUrl: stdReg?.baseUrl || "",
          apiKeyEnvVar: stdReg?.apiKeyEnvVar || `${cfg.id.toUpperCase()}_API_KEY`,
          models: stdReg?.models || [],
          priority: cfg.priority,
        };
      });

      // Filter based on plan routing rules
      eligibleProviders = merged.filter((p) => {
        if (request.useCase === "keyword_extraction") {
          return true;
        }
        if (request.userPlan === "free") {
          return p.priority >= 3;
        }
        if (request.userPlan === "starter") {
          return p.priority >= 2;
        }
        return true;
      });
    }
  } catch (err) {
    console.error("Error loading provider configs from DB, using default waterfall:", err);
  }

  // If there's a preferred provider, put it first (if eligible)
  if (request.preferredProviderId) {
    const pref = eligibleProviders.find((p) => p.id === request.preferredProviderId);
    if (pref) {
      eligibleProviders = [pref, ...eligibleProviders.filter((p) => p.id !== request.preferredProviderId)];
    }
  }

  // 2. Load daily usage limits from database to skip exhausted providers
  const { data: usageData } = await db
    .from("provider_usage_daily")
    .select("provider_id, request_count, token_count")
    .eq("date", dateStr);

  const usageMap = new Map<string, { requests: number; tokens: number }>();
  if (usageData) {
    usageData.forEach((row: any) => {
      usageMap.set(row.provider_id, { requests: row.request_count, tokens: row.token_count });
    });
  }

  // Determine timeout based on use case
  // Keep well under Vercel Hobby 10s limit on Vercel, but allow longer locally
  let timeoutMs = 8000; // 8s default on Vercel to give content generation enough time to complete
  if (!process.env.VERCEL) {
    timeoutMs = 60000; // 60s locally to allow slower high-quality models to complete
  } else if (request.useCase === "transcript_correction") {
    timeoutMs = 4000; // 4s on Vercel
  } else if (request.useCase === "style_analysis") {
    timeoutMs = 4500; // 4.5s on Vercel
  }

  // Helper to check if a provider has its API key or configuration set
  const isProviderConfigured = (p: any) => {
    let apiKey = process.env[p.apiKeyEnvVar];
    if (p.id === "google") {
      apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
    if (p.id === "cloudflare") {
      return !!process.env.CLOUDFLARE_ACCOUNT_ID && !!process.env.CLOUDFLARE_AI_API_KEY;
    }
    return !!apiKey;
  };

  // 3c. Filter eligible providers by active configuration/API keys
  const allList = Object.values(PROVIDERS).sort((a, b) => a.priority - b.priority);
  const allConfigured = allList.filter(isProviderConfigured);

  let configuredProviders = eligibleProviders.filter(isProviderConfigured);

  // If no configured providers match the plan, use all configured ones
  if (configuredProviders.length === 0) {
    configuredProviders = allConfigured;
  }

  // To prevent total failure, append any other configured providers as a final fallback chain
  const finalFallbackList = allConfigured.filter(
    (p) => !configuredProviders.some((cp) => cp.id === p.id)
  );

  eligibleProviders = [...configuredProviders, ...finalFallbackList];

  const fallbackChain: string[] = [];
  const errorsChain: { provider: string; error: string }[] = [];

  // 4. Iterate over eligible providers
  for (const provider of eligibleProviders) {
    let apiKey = process.env[provider.apiKeyEnvVar];
    if (provider.id === "google") {
      apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    }
    if (!apiKey && provider.id !== "cloudflare") {
      // Skip if API key is not configured locally
      continue;
    }

    // Check daily limit (e.g. 1500 for Google, 1000 for Groq, etc.)
    const dailyLimit = dailyLimitOverrides.get(provider.id) ?? getDailyLimit(provider.id);
    const currentUsage = usageMap.get(provider.id) || { requests: 0, tokens: 0 };
    if (currentUsage.requests >= dailyLimit) {
      console.warn(`Provider ${provider.name} is at its daily limit of ${dailyLimit} requests. Skipping.`);
      continue;
    }

    fallbackChain.push(provider.name);
    const startTime = Date.now();

    // Map plan to specific models as defined in provider configs (use DB override if set)
    const model = modelOverrides.get(provider.id) || getModelForPlan(provider, request.userPlan);

    try {
      let content = "";
      let inputTokens = 0;
      let outputTokens = 0;

      if (provider.id === "cloudflare") {
        // Cloudflare Workers AI custom endpoint
        const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        const cfApiKey = process.env.CLOUDFLARE_AI_API_KEY;
        if (!cfAccountId || !cfApiKey) continue;

        const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`;
        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: request.messages,
              max_tokens: request.maxTokens || 800,
            }),
          },
          timeoutMs
        );

        if (!response.ok) {
          let errorText = "";
          try {
            errorText = await response.text();
          } catch (_) {}
          throw new Error(`Cloudflare API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        content = data.result?.response || "";
        inputTokens = 0; // Cloudflare doesn't return tokens, estimate
        outputTokens = 0;
      } else if (provider.id === "google" && request.enableSearch) {
        // Native Gemini REST API call with search grounding
        const nativeModel = model.startsWith("models/") ? model : `models/${model}`;
        const url = `https://generativelanguage.googleapis.com/v1beta/${nativeModel}:generateContent?key=${apiKey}`;
        
        let systemInstruction = "";
        const contents = [];

        for (const msg of request.messages) {
          if (msg.role === "system") {
            systemInstruction = msg.content;
          } else {
            contents.push({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content }]
            });
          }
        }

        const nativePayload: any = {
          contents,
          tools: [{ google_search: {} }],
        };

        if (systemInstruction) {
          nativePayload.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const response = await fetchWithTimeout(
          url,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(nativePayload),
          },
          timeoutMs
        );

        if (!response.ok) {
          let errorText = "";
          try {
            errorText = await response.text();
          } catch (_) {}
          throw new Error(`Gemini Native API returned status ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        inputTokens = data.usageMetadata?.promptTokenCount || 0;
        outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
      } else {
        // OpenAI Compatible API
        const payload: any = {
          model: model,
          messages: request.messages,
          temperature: request.useCase === "style_analysis" ? 0.2 : 0.7,
        };

        if (request.maxTokens) {
          payload.max_tokens = request.maxTokens;
        }

        if (request.responseFormat === "json" && provider.id !== "nvidia") {
          payload.response_format = { type: "json_object" };
        }

        const response = await fetchWithTimeout(
          `${provider.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
          timeoutMs
        );

        if (!response.ok) {
          let errorText = "";
          try {
            errorText = await response.text();
          } catch (_) {}
          
          if (response.status === 429) {
            throw new Error(`Rate limit exceeded (429) - ${errorText}`);
          }
          throw new Error(`API returned status ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        content = data.choices?.[0]?.message?.content || "";
        inputTokens = data.usage?.prompt_tokens || 0;
        outputTokens = data.usage?.completion_tokens || 0;
      }

      const latencyMs = Date.now() - startTime;

      // Log success to db async
      await logUsage(db, provider.id, dateStr, inputTokens, outputTokens);
      await logGenerationEvent(db, request, provider.id, model, inputTokens, outputTokens, latencyMs, fallbackChain, true);

      return {
        content,
        provider: provider.name,
        model,
        inputTokens,
        outputTokens,
        latencyMs,
        fallbackChain,
      };
    } catch (err: any) {
      console.error(`Provider ${provider.name} failed: ${err.message}`);
      errorsChain.push({ provider: provider.name, error: err.message });
      // Log failure in background and continue loop
      await logGenerationEvent(db, request, provider.id, model, 0, 0, Date.now() - startTime, fallbackChain, false, err.message);
    }
  }

  // Log complete failure chain to admin logs if possible
  console.error("All eligible LLM providers exhausted.", errorsChain);
  throw new LLMExhaustedError();
}

function getDailyLimit(providerId: string): number {
  switch (providerId) {
    case "nvidia": return 5000;
    case "google": return 1500;
    case "groq": return 1000;
    case "cerebras": return 14400;
    case "openrouter": return 50;
    case "cloudflare": return 1000;
    default: return 100;
  }
}

function getModelForPlan(provider: ProviderConfig, plan: string): string {
  // Return the first available model if none specified
  if (provider.models.length === 0) return "";
  
  if (provider.id === "nvidia") {
    // Pro/Agency only
    return provider.models[0]; // nvidia/llama-3.3-nemotron-super-49b-v1
  }

  if (provider.id === "google") {
    return "gemini-2.0-flash";
  }

  if (provider.id === "groq") {
    // Return larger versatile model for paid, faster/smaller for free
    return plan === "free" ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile";
  }

  if (provider.id === "cerebras") {
    return plan === "free" ? "llama3.1-8b" : "llama3.3-70b";
  }

  return provider.models[0];
}

async function logUsage(db: any, providerId: string, dateStr: string, inputTokens: number, outputTokens: number) {
  try {
    // Increment requests and tokens count daily
    const { data } = await db.rpc("increment_provider_usage", {
      p_id: providerId,
      p_date: dateStr,
      p_tokens: inputTokens + outputTokens
    });
    
    if (!data) {
      // Fallback manual upsert if RPC is not deployed yet
      await db.from("provider_usage_daily").upsert({
        provider_id: providerId,
        date: dateStr,
        request_count: 1,
        token_count: inputTokens + outputTokens
      }, { onConflict: "provider_id,date" });
    }
  } catch (err) {
    // Ignore logging errors to prevent blocking the main request
  }
}

async function logGenerationEvent(
  db: any,
  request: LLMRequest,
  providerId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  fallbackChain: string[],
  success: boolean,
  errorCode?: string
) {
  try {
    await db.from("generation_events").insert({
      user_id: request.userId,
      session_id: request.sessionId,
      post_id_hash: request.useCase === "content_generation" || request.useCase === "regeneration" ? "generating" : null,
      use_case: request.useCase,
      provider_attempted: fallbackChain,
      provider_succeeded: success ? providerId : null,
      model_used: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_latency_ms: latencyMs,
      attempt_count: fallbackChain.length,
      fallback_count: fallbackChain.length - 1,
      success: success,
      error_code: errorCode || null,
    });
  } catch (err) {
    // Ignore logging errors
  }
}
