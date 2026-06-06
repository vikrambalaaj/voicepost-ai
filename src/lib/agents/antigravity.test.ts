import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAntigravityAgent } from "./antigravity";
import { spawn } from "child_process";
import { EventEmitter } from "events";

// Mock child_process module
vi.mock("child_process", () => {
  return {
    spawn: vi.fn(),
  };
});

describe("Antigravity Agent Wrapper", () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReset();
  });

  it("should successfully invoke the Python script and return parsed output", async () => {
    // Arrange
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = {
      write: vi.fn(),
      end: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockProcess);

    const testInput = {
      action: "generate" as const,
      transcript: "Hello world transcript",
      style_json: { avg_post_length_words: 50 },
    };

    const mockResponse = {
      success: true,
      result: {
        post_content: "This is a polished LinkedIn post",
        hashtags: ["ai", "growth"],
        hook_type: "contrast",
        post_structure: "3-part",
        style_match_score: 9,
        style_deviations: [],
      },
      thoughts: "Agent finished successfully.",
    };

    // Act
    const promise = runAntigravityAgent(testInput);

    // Simulate stdout data
    mockProcess.stdout.emit("data", Buffer.from(JSON.stringify(mockResponse)));
    // Simulate close event
    mockProcess.emit("close", 0);

    const res = await promise;

    // Assert
    expect(res.success).toBe(true);
    expect(res.result?.post_content).toBe("This is a polished LinkedIn post");
    expect(res.thoughts).toBe("Agent finished successfully.");
    expect(vi.mocked(spawn)).toHaveBeenCalled();
    expect(mockProcess.stdin.write).toHaveBeenCalledWith(JSON.stringify(testInput));
  });

  it("should return failure if subprocess stdout has invalid JSON", async () => {
    // Arrange
    const mockProcess = new EventEmitter() as any;
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.stdin = {
      write: vi.fn(),
      end: vi.fn(),
    };

    vi.mocked(spawn).mockReturnValue(mockProcess);

    // Act
    const promise = runAntigravityAgent({ action: "generate", transcript: "test" });

    // Emit invalid JSON on stdout and some stderr
    mockProcess.stdout.emit("data", Buffer.from("invalid json output"));
    mockProcess.stderr.emit("data", Buffer.from("some python error"));
    mockProcess.emit("close", 1);

    const res = await promise;

    // Assert
    expect(res.success).toBe(false);
    expect(res.error).toContain("Agent execution failed");
    expect(res.error).toContain("some python error");
  });
});
