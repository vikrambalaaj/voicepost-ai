import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- configurable Supabase mock -------------------------------------------------
let existingAccount: any = null; // row returned by the linkedin_accounts "existing" lookup
const calls: { table: string; op: string; payload?: any }[] = [];

function builder(table: string) {
  let op = "select";
  const b: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") {
          const data = table === "linkedin_accounts" && op === "select" ? (existingAccount ? [existingAccount] : []) : [];
          return (res: any) => Promise.resolve({ data, error: null }).then(res);
        }
        if (prop === "single" || prop === "maybeSingle") {
          return () => Promise.resolve({ data: { id: "acc-1", scraping_status: "running" }, error: null });
        }
        return (...args: any[]) => {
          if (["insert", "update", "upsert", "delete"].includes(prop)) {
            op = prop;
            calls.push({ table, op: prop, payload: args[0] });
          }
          return b;
        };
      },
    }
  );
  return b;
}
vi.mock("@/lib/supabase", () => ({
  getServiceSupabase: () => ({ from: (t: string) => builder(t), rpc: vi.fn() }),
}));
vi.mock("@/lib/audit", () => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({ getAuthenticatedUserId: vi.fn().mockResolvedValue(null) }));

import { GET } from "./route";
import { getAuthenticatedUserId } from "@/lib/auth";

const demoCb = () =>
  new NextRequest("http://localhost/api/auth/linkedin/callback?code=mock_code&state=tok123:login&purpose=login", {
    headers: { cookie: "linkedin_oauth_state=tok123:login" },
  });

describe("LinkedIn OAuth callback", () => {
  beforeEach(() => {
    calls.length = 0;
    existingAccount = null;
    process.env.SESSION_SECRET = "a-test-secret-that-is-long-enough";
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.DEMO_LOGIN_ENABLED;
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
  });

  it("rejects a demo callback that has no matching state cookie (no drive-by demo session)", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/auth/linkedin/callback?code=mock_code&purpose=login")
    );
    expect(res.headers.get("location")).toContain("csrf_failed");
    expect(res.headers.get("set-cookie") || "").not.toContain("vp_session=ey");
  });

  it("demo login never replaces an existing signed-in session", async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue("real-user-1");
    const res = await GET(demoCb());
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
    expect(res.headers.get("set-cookie") || "").not.toContain("vp_session=ey");
    expect(calls.some((c) => c.table === "users")).toBe(false);
  });

  it("demo login can be switched off", async () => {
    process.env.DEMO_LOGIN_ENABLED = "false";
    const res = await GET(demoCb());
    expect(res.headers.get("location")).toContain("demo_disabled");
  });

  it("rejects a real OAuth code whose state does not match the cookie (CSRF)", async () => {
    process.env.LINKEDIN_CLIENT_ID = "id";
    process.env.LINKEDIN_CLIENT_SECRET = "secret";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost/api/auth/linkedin/callback";
    const res = await GET(
      new NextRequest("http://localhost/api/auth/linkedin/callback?code=real&state=attacker:login", {
        headers: { cookie: "linkedin_oauth_state=victim:login" },
      })
    );
    expect(res.headers.get("location")).toContain("csrf_failed");
    expect(res.headers.get("set-cookie") || "").not.toContain("vp_session=ey");
  });

  it("a cancelled LinkedIn consent (no code, valid state) never falls through to the mock profile", async () => {
    process.env.LINKEDIN_CLIENT_ID = "id";
    process.env.LINKEDIN_CLIENT_SECRET = "secret";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost/api/auth/linkedin/callback";
    const res = await GET(
      new NextRequest(
        "http://localhost/api/auth/linkedin/callback?error=user_cancelled_login&state=tok123:login",
        { headers: { cookie: "linkedin_oauth_state=tok123:login" } }
      )
    );
    expect(res.headers.get("location")).toContain("oauth_failed");
    expect(res.headers.get("set-cookie") || "").not.toContain("vp_session=ey");
    expect(calls.some((c) => c.table === "users" || c.table === "linkedin_accounts")).toBe(false);
  });

  it("rejects a real OAuth code with no state cookie at all", async () => {
    process.env.LINKEDIN_CLIENT_ID = "id";
    process.env.LINKEDIN_CLIENT_SECRET = "secret";
    process.env.LINKEDIN_REDIRECT_URI = "http://localhost/api/auth/linkedin/callback";
    const res = await GET(
      new NextRequest("http://localhost/api/auth/linkedin/callback?code=real&state=x:login")
    );
    expect(res.headers.get("location")).toContain("csrf_failed");
  });

  it("first login goes through the scraping screen and sets a signed session", async () => {
    const res = await GET(demoCb());
    expect(res.headers.get("location")).toContain("/settings/linkedin/scraping?redirect=/dashboard");
    expect(res.headers.get("set-cookie")).toContain("vp_session=");
  });

  it("returning login with a fresh complete scrape skips straight to the dashboard and keeps scrape state", async () => {
    existingAccount = { id: "acc-1", scraping_status: "complete", last_scraped_at: new Date().toISOString() };
    const res = await GET(demoCb());
    expect(res.headers.get("location")).toMatch(/\/dashboard$/);
    const upd = calls.find((c) => c.table === "linkedin_accounts" && c.op === "update");
    expect(upd?.payload).toBeDefined();
    expect(upd!.payload).not.toHaveProperty("scraping_status");
    expect(upd!.payload).not.toHaveProperty("last_scraped_at");
  });

  it("a stale scrape (older than 7 days) is refreshed", async () => {
    existingAccount = { id: "acc-1", scraping_status: "complete", last_scraped_at: new Date(Date.now() - 8 * 86400000).toISOString() };
    const res = await GET(demoCb());
    expect(res.headers.get("location")).toContain("/settings/linkedin/scraping");
  });

  it("does not issue a session (and does not crash) when SESSION_SECRET is missing in production", async () => {
    delete process.env.SESSION_SECRET;
    (process.env as any).NODE_ENV = "production";
    vi.resetModules();
    const { GET: prodGET } = await import("./route");
    const res = await prodGET(demoCb());
    (process.env as any).NODE_ENV = "test";
    expect(res.headers.get("location")).toContain("server_config");
    expect(res.headers.get("set-cookie") || "").not.toContain("vp_session=ey");
  });
});
