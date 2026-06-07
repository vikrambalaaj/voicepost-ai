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
    }
    return Promise.resolve({ data, error: null }).then(onfulfilled);
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

describe("Publish Post API Route (/api/posts/[id]/publish)", () => {
  let db: any;

  beforeEach(() => {
    db = getServiceSupabase();
    vi.mocked(db.from).mockClear();
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
});
