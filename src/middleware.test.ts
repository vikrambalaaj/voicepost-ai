import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { middleware } from "./middleware";

const SECRET = "a-test-secret-that-is-long-enough";

function sign(payload: object, secret = SECRET) {
  const enc = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${enc}.${createHmac("sha256", secret).update(enc).digest("hex")}`;
}
const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie: `vp_session=${cookie}` } } : undefined);

describe("middleware", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });

  it("redirects anonymous page requests to /login", async () => {
    const res = await middleware(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns JSON 401 (not a redirect) for anonymous API calls", async () => {
    const res = await middleware(req("/api/posts"));
    expect(res.status).toBe(401);
  });

  it("accepts a correctly signed session", async () => {
    const res = await middleware(req("/dashboard", sign({ userId: "u1", exp: Date.now() + 60000 })));
    expect(res.headers.get("location")).toBeNull();
  });

  it("rejects an unsigned/forged session cookie", async () => {
    const forged = Buffer.from(JSON.stringify({ userId: "x", email: "vikram.bala@digitalfoundry.ai", exp: 9e15 })).toString("base64");
    const res = await middleware(req("/admin", `${forged}.deadbeef`));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("rejects a cookie signed with a different secret", async () => {
    const res = await middleware(req("/dashboard", sign({ userId: "u1", exp: Date.now() + 60000 }, "some-other-secret-value-1234")));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("lets cron and Stripe webhook calls through (they authenticate themselves)", async () => {
    expect((await middleware(req("/api/cron/fetch-trends"))).status).toBe(200);
    expect((await middleware(req("/api/webhooks/stripe"))).status).toBe(200);
  });

  it("no longer exposes the hard-coded db-check diagnostic endpoint publicly", async () => {
    const res = await middleware(req("/api/admin/db-check?secret=vp_diag_2026"));
    expect(res.status).toBe(401);
  });

  it("sends logged-in users from / and /login to the dashboard", async () => {
    const c = sign({ userId: "u1", exp: Date.now() + 60000 });
    expect((await middleware(req("/", c))).headers.get("location")).toContain("/dashboard");
    expect((await middleware(req("/login", c))).headers.get("location")).toContain("/dashboard");
  });
});
