import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { routeLLMRequest } from "./router";
import { getServiceSupabase } from "../supabase";

class MockQueryBuilder {
  private data: any;
  constructor(data: any) {
    this.data = data;
  }
  select = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  then = vi.fn().mockImplementation((onfulfilled) => {
    return Promise.resolve({ data: this.data, error: null }).then(onfulfilled);
  });
}

// Mock Supabase module
vi.mock("../supabase", () => {
  const dbMock = {
    from: vi.fn().mockImplementation(() => new MockQueryBuilder([])),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    getServiceSupabase: () => dbMock,
  };
});

describe("LLM Router", () => {
  let mockDb: any;
  let mockFetch: any;

  beforeEach(() => {
    mockDb = getServiceSupabase();
    mockDb.from.mockClear();
    mockDb.rpc.mockClear();
    
    // Save original fetch
    mockFetch = global.fetch;
    global.fetch = vi.fn();

    // Setup default mock env variables
    process.env.GROQ_API_KEY = "mock_groq_key";
    process.env.GOOGLE_AI_STUDIO_API_KEY = "mock_google_key";
    process.env.NVIDIA_NIM_API_KEY = "mock_nvidia_key";
  });

  afterEach(() => {
    global.fetch = mockFetch;
  });

  it("should respect plan-based filtering rules (free plan uses priority >= 3)", async () => {
    mockDb.from.mockImplementation(() => new MockQueryBuilder([]));

    // Mock fetch response for Groq (which is priority 3 and first eligible for free plan)
    const mockFetchFn = global.fetch as any;
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Mocked response content" } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }),
    });

    const res = await routeLLMRequest({
      useCase: "content_generation",
      messages: [{ role: "user", content: "Hello" }],
      userId: "test_user_id",
      userPlan: "free",
      sessionId: "test_session_id",
    });

    expect(res.content).toBe("Mocked response content");
    expect(res.provider).toBe("Groq"); // Free plan defaults to priority 3 (Groq) first
    expect(res.fallbackChain).toContain("Groq");
    expect(res.fallbackChain).not.toContain("NVIDIA NIM"); // Priority 1 (Pro only)
    expect(res.fallbackChain).not.toContain("Google AI Studio"); // Priority 2 (Starter/Pro only)
  });

  it("should perform waterfall failover if the primary provider fails", async () => {
    // Free plan: attempts Groq (priority 3), then OpenRouter (5), then Cloudflare (6)
    process.env.GROQ_API_KEY = "mock_groq_key";
    process.env.OPENROUTER_API_KEY = "mock_openrouter_key";
    process.env.CLOUDFLARE_ACCOUNT_ID = "mock_cf_id";
    process.env.CLOUDFLARE_AI_API_KEY = "mock_cf_key";

    mockDb.from.mockImplementation(() => new MockQueryBuilder([]));

    const mockFetchFn = global.fetch as any;
    // Mock first fetch call (Groq) to fail
    // Mock second fetch call (OpenRouter) to succeed
    mockFetchFn
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: "Fallback success content" } }],
          usage: { prompt_tokens: 15, completion_tokens: 25 },
        }),
      });

    const res = await routeLLMRequest({
      useCase: "content_generation",
      messages: [{ role: "user", content: "Hello" }],
      userId: "test_user_id",
      userPlan: "free",
      sessionId: "test_session_id",
    });

    expect(res.content).toBe("Fallback success content");
    expect(res.provider).toBe("OpenRouter");
    expect(res.fallbackChain).toContain("Groq");
    expect(res.fallbackChain).toContain("OpenRouter");
  });

  it("should skip providers that have hit their daily limit", async () => {
    // Mock daily usage to show Google has hit limit of 1500
    mockDb.from.mockImplementation((table: string) => {
      if (table === "provider_usage_daily") {
        return new MockQueryBuilder([
          { provider_id: "google", request_count: 1500, token_count: 5000 },
        ]);
      }
      return new MockQueryBuilder([]);
    });

    const mockFetchFn = global.fetch as any;
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Groq response content" } }],
        usage: { prompt_tokens: 10, completion_tokens: 15 },
      }),
    });

    const res = await routeLLMRequest({
      useCase: "content_generation",
      messages: [{ role: "user", content: "Hello" }],
      userId: "test_user_id",
      userPlan: "starter",
      sessionId: "test_session_id",
    });

    expect(res.provider).toBe("Groq"); // Skips Google, calls Groq
    expect(res.content).toBe("Groq response content");
    expect(res.fallbackChain).toContain("Groq");
    expect(res.fallbackChain).not.toContain("Google AI Studio");
  });

  it("should bypass plan constraints for keyword_extraction use case on free plan to use NVIDIA NIM", async () => {
    process.env.NVIDIA_NIM_API_KEY = "mock_nvidia_key";
    mockDb.from.mockImplementation(() => new MockQueryBuilder([]));

    const mockFetchFn = global.fetch as any;
    mockFetchFn.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "extracted search query" } }],
        usage: { prompt_tokens: 10, completion_tokens: 15 },
      }),
    });

    const res = await routeLLMRequest({
      useCase: "keyword_extraction",
      messages: [{ role: "user", content: "Extract search query" }],
      userId: "test_user_id",
      userPlan: "free",
      sessionId: "test_session_id",
    });

    expect(res.provider).toBe("NVIDIA NIM");
    expect(res.content).toBe("extracted search query");
    expect(res.fallbackChain).toContain("NVIDIA NIM");
  });
});
