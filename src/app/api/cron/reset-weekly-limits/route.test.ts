import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const updates: any[] = [];
vi.mock("@/lib/supabase", () => ({
  getServiceSupabase: () => ({
    from: () => ({
      update: (row: any) => {
        updates.push(row);
        return { gte: () => Promise.resolve({ error: null }) };
      },
    }),
  }),
}));

import { GET } from "./route";

const call = (qs = "") =>
  GET(
    new NextRequest(`http://localhost/api/cron/reset-weekly-limits${qs}`, {
      headers: { authorization: "Bearer cron-secret" },
    })
  );

describe("reset-weekly-limits cron", () => {
  beforeEach(() => {
    updates.length = 0;
    process.env.CRON_SECRET = "cron-secret";
  });

  it("rejects calls without the cron secret", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cron/reset-weekly-limits"));
    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("weekly run resets only the weekly counters", async () => {
    await call();
    expect(updates).toEqual([{ posts_used_this_week: 0, ai_images_used_this_week: 0 }]);
  });

  it("monthly run resets only the monthly counter, never the weekly ones", async () => {
    await call("?scope=month");
    expect(updates).toEqual([{ posts_used_this_month: 0 }]);
  });
});
