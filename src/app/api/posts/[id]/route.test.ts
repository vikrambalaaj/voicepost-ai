import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";
import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Mock auth helper
vi.mock("@/lib/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user_123"),
}));

const mockPost = {
  id: "post_123",
  user_id: "user_123",
  post_content: "Original Content",
  hashtags: ["original"],
  current_revision: 1,
  status: "draft",
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
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();

  single = vi.fn().mockImplementation(() => {
    if (this.table === "posts") {
      return Promise.resolve({ data: mockPost, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  then = vi.fn().mockImplementation((onfulfilled) => {
    let data: any = [];
    if (this.table === "post_revisions") {
      data = [{ revision_number: 1, post_content: "Original Content" }];
    } else if (this.table === "post_images") {
      data = [];
    } else if (this.table === "voice_recordings") {
      data = [];
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

describe("Post Details API Route (/api/posts/[id])", () => {
  let db: any;

  beforeEach(() => {
    db = getServiceSupabase();
    vi.mocked(db.from).mockClear();
  });

  it("should successfully fetch post details and its revisions", async () => {
    const req = new NextRequest("http://localhost:6250/api/posts/post_123");
    const res = await GET(req, { params: { id: "post_123" } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.post.id).toBe("post_123");
    expect(body.revisions.length).toBeGreaterThan(0);
  });

  it("should increment revision and save history on content change", async () => {
    const updateMock = vi.fn().mockReturnThis();
    const insertMock = vi.fn().mockResolvedValue({ data: {}, error: null });

    const postsQueryBuilder = new MockQueryBuilder("posts");
    postsQueryBuilder.update = updateMock;

    const revQueryBuilder = new MockQueryBuilder("post_revisions");
    revQueryBuilder.insert = insertMock;

    vi.mocked(db.from).mockImplementation((table: string) => {
      if (table === "posts") return postsQueryBuilder;
      if (table === "post_revisions") return revQueryBuilder;
      return new MockQueryBuilder(table);
    });

    const req = new NextRequest("http://localhost:6250/api/posts/post_123", {
      method: "PUT",
      body: JSON.stringify({
        post_content: "Updated Content",
        hashtags: ["original"],
      }),
    });

    const res = await PUT(req, { params: { id: "post_123" } });
    expect(res.status).toBe(200);

    // Verify updates to posts table included revision increment (current_revision = 2)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        post_content: "Updated Content",
        current_revision: 2,
      })
    );

    // Verify insert into post_revisions table occurred
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        revision_number: 2,
        post_content: "Updated Content",
        feedback_given: "Manual edit",
      })
    );
  });
});
