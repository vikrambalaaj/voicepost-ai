import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

// Mock LLM router
vi.mock("@/lib/llm/router", () => ({
  routeLLMRequest: vi.fn().mockResolvedValue({
    content: "This is a high-impact automated demo post about software engineering.",
    provider: "Google AI Studio",
  }),
}));

// Mock Audit Logger
vi.mock("@/lib/audit", () => ({
  logAuditEvent: vi.fn().mockResolvedValue(null),
}));

const mockUser = {
  id: "00000000-0000-0000-0000-000000000000",
  plan: "pro",
  posts_used_this_week: 2,
  posts_limit_weekly: 10,
};

const mockPost = {
  id: "post_cron_123",
  user_id: "00000000-0000-0000-0000-000000000000",
  post_title: "Automated Demo Post",
  post_content: "This is a high-impact automated demo post about software engineering.",
  hashtags: ["softwareengineering"],
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
    if (this.table === "users") {
      return Promise.resolve({ data: mockUser, error: null });
    }
    if (this.table === "posts") {
      return Promise.resolve({ data: mockPost, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  then(onfulfilled: any) {
    if (this.table === "linkedin_accounts") {
      return Promise.resolve({
        data: [{ id: "acc_123", is_primary: true, access_token: "mock_token" }],
        error: null,
      }).then(onfulfilled);
    }
    return Promise.resolve({ data: null, error: null }).then(onfulfilled);
  }
}

vi.mock("@/lib/supabase", () => {
  const dbMock = {
    from: vi.fn().mockImplementation((table: string) => new MockQueryBuilder(table)),
  };
  return {
    getServiceSupabase: () => dbMock,
  };
});

describe("Automated Demo Post Cron Endpoint", () => {
  let db: any;

  beforeEach(() => {
    db = getServiceSupabase();
    vi.mocked(db.from).mockClear();
  });

  it("should successfully generate and publish a demo post when cron triggers", async () => {
    const req = new NextRequest("http://localhost:6250/api/cron/demo-post");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.post_id).toBe("post_cron_123");
    expect(body.scheduled_interval).toBe("every 4 days");
  });
});
