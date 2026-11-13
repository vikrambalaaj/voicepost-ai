import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getServiceSupabase: () => ({}) }));
vi.mock("@/lib/agents/antigravity", () => ({ runAntigravityAgent: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendApprovalEmailInternal: vi.fn() }));

import { buildSystemPrompt } from "./route";

describe("buildSystemPrompt", () => {
  it("adds no empty style bullets and no emoji ban when nothing is set", () => {
    const p = buildSystemPrompt();
    expect(p).not.toMatch(/^- $/m);
    expect(p).not.toContain("CRITICAL STYLE INSTRUCTIONS");
    expect(p).not.toMatch(/do not use (any )?emojis/i);
  });

  it("honours a high Creator DNA emoji density", () => {
    expect(buildSystemPrompt({ dna_emoji_density: 90 })).toContain("Include emojis frequently");
  });

  it("follows the analysed style's uses_emojis when no DNA slider is set", () => {
    expect(buildSystemPrompt({ uses_emojis: false })).toContain("Do not use emojis.");
    expect(buildSystemPrompt({ uses_emojis: true })).toContain("Use emojis sparingly");
  });

  it("tolerates a null style", () => {
    expect(() => buildSystemPrompt(null)).not.toThrow();
  });
});
