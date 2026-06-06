import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { runAntigravityAgent } from "@/lib/agents/antigravity";
import { getAuthenticatedUserId } from "@/lib/auth";

// Mock user, style, and post details
const mockUser = {
  id: "mock_user_123",
  email: "test@example.com",
  plan: "pro",
  industry: "Marketing",
  job_title: "CMO",
};

const mockStyle = {
  style_json: {
    avg_post_length_words: 100,
    tone_descriptor: "bold",
  },
};

const mockNewPost = {
  id: "new_post_999",
  post_content: "Polished post content",
  hashtags: ["marketing", "growth"],
  style_match_score: 9,
};

class MockQueryBuilder {
  private table: string;
  constructor(table: string) {
    this.table = table;
  }

  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  update = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();

  single = vi.fn().mockImplementation(() => {
    let data: any = {};
    if (this.table === "users") data = mockUser;
    else if (this.table === "expert_styles") data = mockStyle;
    else if (this.table === "posts") data = mockNewPost;
    return Promise.resolve({ data, error: null });
  });

  then = vi.fn().mockImplementation((onfulfilled) => {
    let data: any = [];
    if (this.table === "posts") {
      data = [{ post_content: "recent post 1" }];
    }
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  });
}

vi.mock("@/lib/supabase", () => {
  const dbMock = {
    from: vi.fn().mockImplementation((table: string) => new MockQueryBuilder(table)),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    getServiceSupabase: () => dbMock,
  };
});

vi.mock("@/lib/llm/router", () => ({
  routeLLMRequest: vi.fn(),
}));

vi.mock("@/lib/agents/antigravity", () => ({
  runAntigravityAgent: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

describe("Content Generation API Route (/api/content/generate)", () => {
  let db: any;

  beforeEach(() => {
    db = getServiceSupabase();
    vi.mocked(db.from).mockClear();
    vi.mocked(routeLLMRequest).mockReset();
    vi.mocked(runAntigravityAgent).mockReset();
    vi.mocked(getAuthenticatedUserId).mockReset();
  });

  it("should return 400 error if transcript is missing", async () => {
    const req = new NextRequest("http://localhost:6250/api/content/generate", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Transcript is required");
  });

  it("should generate post using waterfall LLM routing by default", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("mock_user_123");

    // Mock LLM Router responses (one for post generation, one for humanizer, one for hashtag enrichment)
    vi.mocked(routeLLMRequest)
      .mockResolvedValueOnce({
        content: JSON.stringify({
          post_content: "Original draft",
          hashtags: ["marketing"],
          hook_type: "contrast",
          post_structure: "3-part",
          style_match_score: 8,
          style_deviations: [],
        }),
        provider: "Google AI Studio",
        model: "gemini-2.0-flash",
        inputTokens: 100,
        outputTokens: 100,
        latencyMs: 500,
        fallbackChain: [],
      }) // Post generation pass
      .mockResolvedValueOnce({
        content: "Polished post content",
        provider: "Groq",
        model: "llama-3-8b",
        inputTokens: 50,
        outputTokens: 50,
        latencyMs: 200,
        fallbackChain: [],
      }) // Humanizer pass
      .mockResolvedValueOnce({
        content: JSON.stringify(["marketing", "growth"]),
        provider: "Groq",
        model: "llama-3-8b",
        inputTokens: 50,
        outputTokens: 50,
        latencyMs: 150,
        fallbackChain: [],
      }); // Hashtag pass

    const req = new NextRequest("http://localhost:6250/api/content/generate", {
      method: "POST",
      body: JSON.stringify({
        transcript: "Growing business to 10k MRR",
        style_type: "expert",
        style_id: "lara_acosta",
        backend: "waterfall",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.post_id).toBe("new_post_999");
    expect(body.approval_package.post_content).toBe("Polished post content");
    expect(body.approval_package.hashtags).toContain("growth");
  });
});
