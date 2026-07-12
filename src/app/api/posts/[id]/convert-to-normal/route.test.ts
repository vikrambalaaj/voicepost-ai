import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Mock auth helper
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user_123"),
}));

// Mock LLM router
vi.mock("@/lib/llm/router", () => ({
  routeLLMRequest: vi.fn().mockResolvedValue({
    content: "This is a single cohesive, high-impact standard LinkedIn text-based post.",
    provider: "Google AI Studio",
  }),
}));

const mockCarouselPost = {
  id: "post_123",
  user_id: "user_123",
  post_content: JSON.stringify({
    type: "carousel",
    title: "My Converted Carousel",
    slides: [
      { slideNumber: 1, type: "cover", title: "Visual Title", body: "Swipe left" },
      { slideNumber: 2, type: "content", title: "Main insight", body: "Here is the body details" }
    ],
  }),
  hashtags: ["original"],
  current_revision: 1,
};

class MockQueryBuilder {
  private table: string;
  constructor(table: string) {
    this.table = table;
  }

  select = vi.fn().mockReturnThis();
  insert = vi.fn().mockResolvedValue({ data: {}, error: null });
  update = vi.fn().mockReturnThis();
  eq = vi.fn().mockReturnThis();

  single = vi.fn().mockImplementation(() => {
    if (this.table === "posts") {
      return Promise.resolve({ data: mockCarouselPost, error: null });
    }
    if (this.table === "users") {
      return Promise.resolve({ data: { plan: "pro" }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

vi.mock("@/lib/supabase", () => {
  const dbMock = {
    from: vi.fn().mockImplementation((table: string) => new MockQueryBuilder(table)),
  };
  return {
    getServiceSupabase: () => dbMock,
  };
});

describe("Convert Carousel to Normal Post API Route", () => {
  let db: any;

  beforeEach(() => {
    db = getServiceSupabase();
    vi.mocked(db.from).mockClear();
  });

  it("should successfully convert a carousel post back to a standard text post", async () => {
    const updateMock = vi.fn().mockReturnThis();
    const insertMock = vi.fn().mockResolvedValue({ data: {}, error: null });

    const postsQueryBuilder = new MockQueryBuilder("posts");
    postsQueryBuilder.update = updateMock;

    const revQueryBuilder = new MockQueryBuilder("post_revisions");
    revQueryBuilder.insert = insertMock;

    const auditQueryBuilder = new MockQueryBuilder("audit_logs");
    auditQueryBuilder.insert = insertMock;

    vi.mocked(db.from).mockImplementation((table: string) => {
      if (table === "posts") return postsQueryBuilder;
      if (table === "post_revisions") return revQueryBuilder;
      if (table === "audit_logs") return auditQueryBuilder;
      return new MockQueryBuilder(table);
    });

    const req = new NextRequest("http://localhost:6250/api/posts/post_123/convert-to-normal", {
      method: "POST",
    });

    const res = await POST(req, { params: { id: "post_123" } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.current_revision).toBe(2);

    // Verify updates to posts table occurred with rewritten text content
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        post_content: "This is a single cohesive, high-impact standard LinkedIn text-based post.",
        current_revision: 2,
      })
    );
  });
});
