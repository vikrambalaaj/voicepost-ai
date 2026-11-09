import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({ getServiceSupabase: () => ({ from: vi.fn(), rpc: vi.fn() }) }));

describe("Stripe webhook", () => {
  it("rejects unsigned events (cannot be used to self-upgrade a plan)", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ type: "customer.subscription.updated", data: { object: {} } }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects everything when the webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.resetModules();
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=abc" },
        body: "{}",
      })
    );
    expect(res.status).toBe(400);
  });
});
