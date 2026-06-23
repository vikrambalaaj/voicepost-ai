import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as regeneratePOST } from "./route";
import { POST as extractTextPOST } from "../extract-text/route";
import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { routeLLMRequest } from "@/lib/llm/router";
import { getAuthenticatedUserId } from "@/lib/auth";
import { humanizePostContent } from "../generate/route";

// Mock user, style, and post details
const mockUser = {
  id: "mock_user_123",
  email: "test@example.com",
  plan: "pro",
  industry: "Marketing",
  job_title: "CMO",
};

const mockPost = {
  id: "post_123",
  user_id: "mock_user_123",
  post_content: "Original draft",
  hashtags: ["marketing"],
  current_revision: 1,
};

class MockQueryBuilder {
  private table: string;
  private updateData: any = null;
  constructor(table: string) {
    this.table = table;
  }

  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockReturnThis();
  update = vi.fn().mockImplementation((val) => {
    this.updateData = val;
    return this;
  });
  eq = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();

  single = vi.fn().mockImplementation(() => {
    let data: any = {};
    if (this.table === "users") data = mockUser;
    else if (this.table === "posts") {
      data = { ...mockPost, ...this.updateData };
    }
    return Promise.resolve({ data, error: null });
  });

  then = vi.fn().mockImplementation((onfulfilled) => {
    let data: any = [];
    if (this.table === "post_revisions") {
      data = [{ revision_number: 1, post_content: "Original draft", feedback_given: "initial", changes_made: [] }];
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

vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

describe("Regeneration and Document Extraction Tests", () => {
  beforeEach(() => {
    vi.mocked(routeLLMRequest).mockReset();
    vi.mocked(getAuthenticatedUserId).mockReset();
  });

  // Test Case 1: Standard Regeneration with feedback
  it("should regenerate post using feedback", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("mock_user_123");
    vi.mocked(routeLLMRequest).mockResolvedValue({
      content: JSON.stringify({
        post_content: "Regenerated content",
        hashtags: ["marketing", "growth"],
        changes_made: ["Made it punchy"],
        style_match_score: 9,
        style_deviations: [],
      }),
      provider: "Groq",
      model: "llama-3-8b",
      inputTokens: 100,
      outputTokens: 100,
      latencyMs: 500,
      fallbackChain: [],
    });

    const req = new NextRequest("http://localhost:6250/api/content/regenerate", {
      method: "POST",
      body: JSON.stringify({
        post_id: "post_123",
        feedback: "Make it punchy",
      }),
    });

    const res = await regeneratePOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.approval_package.post_content).toContain("Regenerated content");
  });

  // Test Case 2: Humanizer helper utilities
  it("should humanize post content successfully", async () => {
    vi.mocked(routeLLMRequest).mockResolvedValue({
      content: "Humanized content",
      provider: "Groq",
      model: "llama-3-8b",
      inputTokens: 50,
      outputTokens: 50,
      latencyMs: 200,
      fallbackChain: [],
    });

    const humanized = await humanizePostContent("Original text", "mock_user_123", "pro", "session_1");
    expect(humanized).toBe("Humanized content");
  });

  // Test Case 3: Document text extraction with TXT files
  it("should extract text from plain text document", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("mock_user_123");
    const formData = new FormData();
    const mockFile = new File(["Hello plain text"], "test.txt", { type: "text/plain" });
    formData.append("file", mockFile);

    const req = new NextRequest("http://localhost:6250/api/content/extract-text", {
      method: "POST",
      body: formData,
    });

    const res = await extractTextPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.text).toBe("Hello plain text");
  });

  // Test Case 4: Document text extraction validation errors
  it("should return 400 error if no file uploaded to extract-text", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("mock_user_123");
    const formData = new FormData();

    const req = new NextRequest("http://localhost:6250/api/content/extract-text", {
      method: "POST",
      body: formData,
    });

    const res = await extractTextPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file uploaded");
  });

  // Test Case 5: Regeneration fails with 400 if post_id or feedback is missing
  it("should return 400 if post_id is missing during regeneration", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("mock_user_123");
    const req = new NextRequest("http://localhost:6250/api/content/regenerate", {
      method: "POST",
      body: JSON.stringify({
        feedback: "Make it better",
      }),
    });

    const res = await regeneratePOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("post_id and feedback are required");
  });
});
