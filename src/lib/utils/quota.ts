/**
 * Shared utility functions for calculating user post quotas and plan limits.
 */

/**
 * Returns the start of the current week (Monday at 00:00:00 UTC) relative to the given date.
 */
export function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getUTCDay();
  // Monday is 1, Sunday is 0. Calculate difference to last Monday
  const diff = result.getUTCDate() - day + (day === 0 ? -6 : 1);
  result.setUTCDate(diff);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/**
 * Counts the number of posts created in the current week (since last Monday 00:00:00 UTC).
 */
export function getPostsCreatedThisWeek(posts: any[], now: Date = new Date()): number {
  if (!Array.isArray(posts)) return 0;
  const lastMonday = getStartOfWeek(now);
  return posts.filter((p: any) => {
    if (!p.created_at) return false;
    const postDate = new Date(p.created_at);
    return postDate >= lastMonday;
  }).length;
}

/**
 * Counts the number of posts created in the current calendar month.
 */
export function getPostsCreatedThisMonth(posts: any[], now: Date = new Date()): number {
  if (!Array.isArray(posts)) return 0;
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  return posts.filter((p: any) => {
    if (!p.created_at) return false;
    const postDate = new Date(p.created_at);
    return postDate.getUTCMonth() === currentMonth && postDate.getUTCFullYear() === currentYear;
  }).length;
}

/**
 * Returns the post and image limits based on user plan subscription.
 */
export function getQuotaLimits(plan: string = "free"): {
  postsLimit: number;
  aiImagesLimit: number;
  isWeekly: boolean;
} {
  const lowerPlan = plan?.toLowerCase() || "free";
  switch (lowerPlan) {
    case "starter":
      return { postsLimit: 15, aiImagesLimit: 10, isWeekly: false };
    case "pro":
      return { postsLimit: 60, aiImagesLimit: 60, isWeekly: false };
    case "agency":
      return { postsLimit: 999999, aiImagesLimit: 999999, isWeekly: false };
    case "free":
    default:
      return { postsLimit: 3, aiImagesLimit: 3, isWeekly: true };
  }
}
