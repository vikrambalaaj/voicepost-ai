import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Mock data
const mockUser = {
  id: "user_123",
  plan: "pro",
  posts_used_this_week: 0,
};

const mockLinkedInAccount = {
  id: "acc_123",
  user_id: "user_123",
  linkedin_profile_id: "urn:li:person:123",
  access_token: "mock_token_123",
  is_primary: true,
};

// Serialized carousel post content
const mockCarouselPost = {
  id: "post_carousel_123",
  user_id: "user_123",
  post_content: JSON.stringify({
    type: "carousel",
    title: "5 Tips for SaaS Founders",
    slides: [
      { slideNumber: 1, title: "Cover Title", body: "Swipe to read", emoji: "🚀" }
    ],
  }),
  hashtags: ["saas", "tech"],
};

// Standard video post content
const mockVideoPost = {
  id: "post_video_123",
  user_id: "user_123",
  post_content: "This is a great video about SaaS!",
  hashtags: ["saas", "video"],
};

const mockVideoAsset = {
  url: "data:video/mp4;base64,AAAAIGZ0eXBtcDQyAAAAAG1w...",
  is_selected: true,
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
  not = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();

  single = vi.fn().mockImplementation(() => {
    let data: any = {};
    if (this.table === "posts") {
      // In the test, we'll configure which post to return by mock values or just return mockCarouselPost by default
      data = mockCarouselPost;
    } else if (this.table === "users") {
      data = mockUser;
    }
    return Promise.resolve({ data, error: null });
  });

  then = vi.fn().mockImplementation((onfulfilled) => {
    let data: any = [];
    if (this.table === "linkedin_accounts") {
      data = [mockLinkedInAccount];
    } else if (this.table === "post_images") {
      data = [mockVideoAsset];
    } else if (this.table === "posts") {
      data = [{ id: "claimed" }]; // publish lock claim succeeded
    }
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  });
}

vi.mock("@/lib/supabase", () => {
  const dbMock = {
    from: vi.fn().mockImplementation((table: string) => new MockQueryBuilder(table)),
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
  };
  return {
    getServiceSupabase: () => dbMock,
  };
});

describe("Publish Post API Route (/api/posts/[id]/publish)", () => {
  let db: any;

  beforeEach(() => {
    db = getServiceSupabase();
    vi.mocked(db.from).mockReset();
    vi.mocked(db.from).mockImplementation((table: string) => new MockQueryBuilder(table));
    db.rpc.mockReset();
    db.rpc.mockResolvedValue({ data: true, error: null });
  });

  it("should successfully mock publish a carousel post with PDF data", async () => {
    const req = new NextRequest("http://localhost:6250/api/posts/post_carousel_123/publish", {
      method: "POST",
      body: JSON.stringify({
        backend: "waterfall",
        carousel_pdf: "data:application/pdf;base64,JVBERi0xLjQK...",
      }),
    });

    const res = await POST(req, { params: { id: "post_carousel_123" } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.linkedin_post_url).toContain("mock_share_");
  });

  it("should successfully mock publish a video post", async () => {
    // Temporarily swap post mock in single()
    const postsQueryBuilder = new MockQueryBuilder("posts");
    postsQueryBuilder.single = vi.fn().mockResolvedValue({ data: mockVideoPost, error: null });
    
    vi.mocked(db.from).mockImplementation((table: string) => {
      if (table === "posts") return postsQueryBuilder;
      return new MockQueryBuilder(table);
    });

    const req = new NextRequest("http://localhost:6250/api/posts/post_video_123/publish", {
      method: "POST",
      body: JSON.stringify({
        backend: "waterfall",
      }),
    });

    const res = await POST(req, { params: { id: "post_video_123" } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.linkedin_post_url).toContain("mock_share_");
  });

  it("returns 409 and does not publish when the post is already published", async () => {
    const postsQueryBuilder = new MockQueryBuilder("posts");
    postsQueryBuilder.single = vi.fn().mockResolvedValue({
      data: { ...mockVideoPost, status: "published" },
      error: null,
    });
    vi.mocked(db.from).mockImplementation((table: string) =>
      table === "posts" ? postsQueryBuilder : new MockQueryBuilder(table)
    );

    const req = new NextRequest("http://localhost:6250/api/posts/post_video_123/publish", {
      method: "POST",
      body: JSON.stringify({ backend: "waterfall" }),
    });
    const res = await POST(req, { params: { id: "post_video_123" } });
    expect(res.status).toBe(409);
  });

  it("returns 403 limit_hit when the atomic quota check refuses", async () => {
    db.rpc.mockResolvedValueOnce({ data: false, error: null });
    const req = new NextRequest("http://localhost:6250/api/posts/post_video_123/publish", {
      method: "POST",
      body: JSON.stringify({ backend: "waterfall" }),
    });
    const res = await POST(req, { params: { id: "post_video_123" } });
    expect(res.status).toBe(403);
    expect((await res.json()).limit_hit).toBe(true);
  });

  it("fails closed (503) and publishes nothing when the quota check errors", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "function does not exist" } });
    const req = new NextRequest("http://localhost:6250/api/posts/post_video_123/publish", {
      method: "POST",
      body: JSON.stringify({ backend: "waterfall" }),
    });
    const res = await POST(req, { params: { id: "post_video_123" } });
    expect(res.status).toBe(503);
    expect(db.rpc).not.toHaveBeenCalledWith("refund_post_quota", expect.anything());
  });

  it("never refunds or re-opens a post once LinkedIn has accepted it", async () => {
    const textPost = { id: "post_text_1", user_id: "user_123", post_content: "Hello LinkedIn", hashtags: [] };
    const realAccount = { ...mockLinkedInAccount, access_token: "real_token_abc" };
    const statusUpdates: any[] = [];
    vi.mocked(db.from).mockImplementation((table: string) => {
      const b = new MockQueryBuilder(table);
      if (table === "posts") {
        b.single = vi.fn().mockResolvedValue({ data: textPost, error: null });
        b.update = vi.fn().mockImplementation((row: any) => {
          statusUpdates.push(row);
          return b;
        });
      }
      if (table === "linkedin_accounts" || table === "post_images") {
        b.then = vi.fn().mockImplementation((ok: any) =>
          Promise.resolve({ data: table === "linkedin_accounts" ? [realAccount] : [], error: null }).then(ok)
        );
      }
      return b;
    });
    process.env.LINKEDIN_CLIENT_ID = "client";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (String(url).includes("ugcPosts")) return new Response("not json", { status: 201 });
      return new Response("{}", { status: 200 });
    });
    try {
      const req = new NextRequest("http://localhost:6250/api/posts/post_text_1/publish", {
        method: "POST",
        body: JSON.stringify({ backend: "waterfall" }),
      });
      const res = await POST(req, { params: { id: "post_text_1" } });
      expect(res.status).toBe(200);
      expect((await res.json()).success).toBe(true);
      expect(db.rpc).not.toHaveBeenCalledWith("refund_post_quota", expect.anything());
      expect(statusUpdates.some((r) => r.status === "published")).toBe(true);
      expect(statusUpdates.some((r) => r.status === "approved")).toBe(false);
    } finally {
      fetchSpy.mockRestore();
      delete process.env.LINKEDIN_CLIENT_ID;
    }
  });
});
