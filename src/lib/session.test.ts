import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "crypto";

async function load() {
  vi.resetModules();
  return await import("./session");
}

describe("session cookies", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.SESSION_SECRET = "a-test-secret-that-is-long-enough";
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  it("round-trips a signed cookie", async () => {
    const { createSessionCookie, verifySessionCookie } = await load();
    const c = createSessionCookie({ userId: "u1", email: "a@b.c" });
    expect(verifySessionCookie(c)?.userId).toBe("u1");
  });

  it("rejects a tampered payload", async () => {
    const { createSessionCookie, verifySessionCookie } = await load();
    const [, sig] = createSessionCookie({ userId: "u1" }).split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "admin", exp: 9e15 })).toString("base64");
    expect(verifySessionCookie(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects a cookie signed with the old hard-coded default secret", async () => {
    const { verifySessionCookie } = await load();
    const payload = Buffer.from(JSON.stringify({ userId: "admin", exp: 9e15 })).toString("base64");
    const sig = createHmac("sha256", "voicepost-dev-secret-change-in-production").update(payload).digest("hex");
    expect(verifySessionCookie(`${payload}.${sig}`)).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    const { verifySessionCookie } = await load();
    const payload = Buffer.from(JSON.stringify({ userId: "u1", exp: Date.now() - 1000 })).toString("base64");
    const sig = createHmac("sha256", process.env.SESSION_SECRET!).update(payload).digest("hex");
    expect(verifySessionCookie(`${payload}.${sig}`)).toBeNull();
  });

  it("fails closed in production when SESSION_SECRET is unset", async () => {
    delete process.env.SESSION_SECRET;
    (process.env as any).NODE_ENV = "production";
    const { createSessionCookie, verifySessionCookie } = await load();
    expect(() => createSessionCookie({ userId: "u1" })).toThrow();
    const payload = Buffer.from(JSON.stringify({ userId: "u1", exp: 9e15 })).toString("base64");
    const sig = createHmac("sha256", "voicepost-dev-secret-change-in-production").update(payload).digest("hex");
    expect(verifySessionCookie(`${payload}.${sig}`)).toBeNull();
  });
});
