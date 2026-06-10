import { describe, it, expect } from "vitest";
import { BeamsBackground } from "./beams-background";

describe("BeamsBackground Component Export", () => {
  it("should export BeamsBackground as a function/component", () => {
    expect(typeof BeamsBackground).toBe("function");
  });
});
