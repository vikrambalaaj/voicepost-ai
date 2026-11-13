import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ getAuthenticatedUserId: vi.fn() }));
vi.mock("@/lib/comments-sync", () => ({
  claimEngagementSync: vi.fn(),
  syncUserEngagement: vi.fn(),
  ENGAGEMENT_SYNC_MAX_POSTS: 10,
}));

import { POST } from "./route";
import { getAuthenticatedUserId } from "@/lib/auth";
import { claimEngagementSync, syncUserEngagement } from "@/lib/comments-sync";

const req = () => new NextRequest("http://localhost/api/engagement/sync", { method: "POST" });

describe("POST /api/engagement/sync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires a session", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
    expect((await POST(req())).status).toBe(401);
    expect(syncUserEngagement).not.toHaveBeenCalled();
  });

  it("skips the sync while the cooldown is running", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("u1");
    vi.mocked(claimEngagementSync).mockResolvedValue(false);
    const body = await (await POST(req())).json();
    expect(body).toEqual({ synced: false, reason: "cooldown" });
    expect(syncUserEngagement).not.toHaveBeenCalled();
  });

  it("syncs the user's recent posts and waits for it to finish", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("u1");
    vi.mocked(claimEngagementSync).mockResolvedValue(true);
    vi.mocked(syncUserEngagement).mockResolvedValue(undefined);
    const body = await (await POST(req())).json();
    expect(body.synced).toBe(true);
    expect(syncUserEngagement).toHaveBeenCalledWith("u1", undefined, 10, expect.any(Number));
  });
});
