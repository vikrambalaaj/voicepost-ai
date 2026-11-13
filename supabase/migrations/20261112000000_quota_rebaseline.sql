-- 2026-11-12: follow-up to 20261109000000_audit_fixes.sql

-- 1. consume_post_quota now enforces posts_limit_monthly for paid plans, but
--    posts_used_this_month was never reliably reset before. Re-baseline it from
--    the posts actually published this calendar month so nobody is blocked by
--    stale usage. Only count posts that went through consume_post_quota: articles
--    are marked published without taking a slot, and posts the user wrote directly
--    on LinkedIn are backfilled from user_posts_raw as 'published' by GET /api/posts.
UPDATE public.users u
SET posts_used_this_month = COALESCE((
  SELECT COUNT(*)
  FROM public.posts p
  WHERE p.user_id = u.id
    AND p.status = 'published'
    AND p.published_at >= date_trunc('month', now())
    AND COALESCE(p.content_type, 'post') <> 'article'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_posts_raw r
      WHERE r.user_id = p.user_id AND r.linkedin_post_id = p.linkedin_post_id
    )
), 0);

-- 2. The per-user rate limiter filters generation_events by user and time window.
CREATE INDEX IF NOT EXISTS idx_generation_events_user_created
  ON public.generation_events(user_id, created_at DESC);

-- 3. The transcribe-status route looks up a stored result on every poll.
CREATE INDEX IF NOT EXISTS idx_voice_recordings_storage_path
  ON public.voice_recordings(storage_path);
