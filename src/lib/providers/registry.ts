export interface LLMModel {
  id: string;
  name: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnvVar: string;
  models: string[];
  priority: number;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  nvidia: {
    id: "nvidia",
    name: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    models: [
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "meta/llama-3.3-70b-instruct",
      "nvidia/nemotron-4-340b-instruct",
      "deepseek-ai/deepseek-r1",
      "qwen/qwen2.5-72b-instruct"
    ],
    priority: 1,
  },
  google: {
    id: "google",
    name: "Google AI Studio",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKeyEnvVar: "GOOGLE_AI_STUDIO_API_KEY",
    models: [
      "gemini-2.0-flash",
      "gemini-2.5-flash-preview-05-20",
      "gemma-3-27b-it"
    ],
    priority: 2,
  },
  groq: {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "qwen/qwen3-32b"
    ],
    priority: 3,
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    apiKeyEnvVar: "CEREBRAS_API_KEY",
    models: [
      "llama3.3-70b",
      "llama3.1-8b"
    ],
    priority: 4,
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnvVar: "OPENROUTER_API_KEY",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "nvidia/nemotron-3-super-120b-a12b:free"
    ],
    priority: 5,
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    baseUrl: "", // Will use custom fetch structure since it is account-based
    apiKeyEnvVar: "CLOUDFLARE_AI_API_KEY",
    models: [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
    ],
    priority: 6,
  }
};

export function getEligibleProviders(plan: "free" | "starter" | "pro" | "agency"): ProviderConfig[] {
  // Plan Routing rules:
  // free plan    → start at priority 3 (Groq). Skip 1, 2, 4.
  // starter plan → start at priority 2 (Google). Skip priority 1.
  // pro plan     → start at priority 1 (NVIDIA NIM). Full waterfall.
  // agency plan  → start at priority 1 (NVIDIA NIM). Full waterfall.

  const allList = Object.values(PROVIDERS).sort((a, b) => a.priority - b.priority);

  switch (plan) {
    case "free":
      // priority 3 (Groq), 5 (OpenRouter), 6 (Cloudflare)
      return allList.filter(p => p.priority === 3 || p.priority === 5 || p.priority === 6);
    case "starter":
      // priority 2 (Google), 3 (Groq), 4 (Cerebras), 5 (OpenRouter), 6 (Cloudflare)
      return allList.filter(p => p.priority >= 2);
    case "pro":
    case "agency":
    default:
      // priority 1, 2, 3, 4, 5, 6
      return allList;
  }
}
