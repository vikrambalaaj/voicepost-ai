import { describe, it, expect } from "vitest";
import {
  getStartOfWeek,
  getPostsCreatedThisWeek,
  getPostsCreatedThisMonth,
  getQuotaLimits,
} from "./quota";

describe("Quota Utilities", () => {
  describe("getStartOfWeek", () => {
    it("should correctly find the start of the week (Monday) for a Wednesday", () => {
      // June 10, 2026 is a Wednesday
      const wednesday = new Date("2026-06-10T15:00:00Z");
      const start = getStartOfWeek(wednesday);
      // Monday should be June 8, 2026
      expect(start.getUTCFullYear()).toBe(2026);
      expect(start.getUTCMonth()).toBe(5); // June is 5 (0-indexed)
      expect(start.getUTCDate()).toBe(8);
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
    });

    it("should correctly handle Sunday boundary", () => {
      // June 14, 2026 is a Sunday
      const sunday = new Date("2026-06-14T23:59:59Z");
      const start = getStartOfWeek(sunday);
      // Monday should be June 8, 2026
      expect(start.getUTCDate()).toBe(8);
    });

    it("should correctly handle Monday itself", () => {
      // June 8, 2026 is a Monday
      const monday = new Date("2026-06-08T08:00:00Z");
      const start = getStartOfWeek(monday);
      expect(start.getUTCDate()).toBe(8);
    });
  });

  describe("getPostsCreatedThisWeek", () => {
    it("should filter and count posts created since last Monday", () => {
      const mockPosts = [
        { created_at: "2026-06-09T10:00:00Z" }, // Tuesday (this week)
        { created_at: "2026-06-08T01:00:00Z" }, // Monday (this week)
        { created_at: "2026-06-07T23:00:00Z" }, // Sunday (last week)
        { created_at: "2026-06-01T10:00:00Z" }, // Older
      ];
      // Check relative to Wednesday, June 10
      const now = new Date("2026-06-10T12:00:00Z");
      expect(getPostsCreatedThisWeek(mockPosts, now)).toBe(2);
    });

    it("should return 0 for invalid post array", () => {
      expect(getPostsCreatedThisWeek(null as any)).toBe(0);
    });
  });

  describe("getPostsCreatedThisMonth", () => {
    it("should count posts created in the same calendar month", () => {
      const mockPosts = [
        { created_at: "2026-06-09T10:00:00Z" }, // June 2026
        { created_at: "2026-06-01T01:00:00Z" }, // June 2026
        { created_at: "2026-05-31T23:00:00Z" }, // May 2026
        { created_at: "2025-06-10T10:00:00Z" }, // June 2025 (different year)
      ];
      const now = new Date("2026-06-10T12:00:00Z");
      expect(getPostsCreatedThisMonth(mockPosts, now)).toBe(2);
    });
  });

  describe("getQuotaLimits", () => {
    it("should return correct limits for free plan", () => {
      expect(getQuotaLimits("free")).toEqual({
        postsLimit: 3,
        aiImagesLimit: 3,
        isWeekly: true,
      });
    });

    it("should return correct limits for pro plan", () => {
      expect(getQuotaLimits("pro")).toEqual({
        postsLimit: 60,
        aiImagesLimit: 60,
        isWeekly: false,
      });
    });

    it("should default to free plan for invalid plan names", () => {
      expect(getQuotaLimits(undefined)).toEqual({
        postsLimit: 3,
        aiImagesLimit: 3,
        isWeekly: true,
      });
    });
  });
});
