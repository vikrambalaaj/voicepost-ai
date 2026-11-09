-- Audit fixes 2026-11-09

-- 1. Columns the app writes but no earlier migration created
ALTER TABLE public.linkedin_accounts ADD COLUMN IF NOT EXISTS profile_email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 2. Allow a 'publishing' lock status (prevents double-publish)
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft','generating','pending_approval','approved','rejected','scheduled','publishing','published','failed'));

-- 3. Indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_posts_user_status ON public.posts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON public.posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_images_post ON public.post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_generation_events_user ON public.generation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_posts_raw_user ON public.user_posts_raw(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_user_primary ON public.linkedin_accounts(user_id, is_primary);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);

-- 4. Atomic post quota (no read-then-write race). Returns true when a slot was taken.
-- NULL / 0 limit means unlimited, except free plan defaults to 3 per week.
CREATE OR REPLACE FUNCTION public.consume_post_quota(p_user UUID)
RETURNS BOOLEAN AS $$
DECLARE ok BOOLEAN;
BEGIN
  UPDATE public.users u
  SET posts_used_this_week = COALESCE(posts_used_this_week, 0) + 1,
      posts_used_this_month = COALESCE(posts_used_this_month, 0) + 1
  WHERE u.id = p_user
    AND (
      CASE WHEN u.plan = 'free' THEN COALESCE(NULLIF(u.posts_limit_weekly, 0), 3)
           ELSE NULLIF(u.posts_limit_weekly, 0) END IS NULL
      OR COALESCE(u.posts_used_this_week, 0) <
         CASE WHEN u.plan = 'free' THEN COALESCE(NULLIF(u.posts_limit_weekly, 0), 3)
              ELSE NULLIF(u.posts_limit_weekly, 0) END
    )
    AND (
      NULLIF(u.posts_limit_monthly, 0) IS NULL
      OR COALESCE(u.posts_used_this_month, 0) < NULLIF(u.posts_limit_monthly, 0)
    )
  RETURNING TRUE INTO ok;
  RETURN COALESCE(ok, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refund_post_quota(p_user UUID)
RETURNS VOID AS $$
  UPDATE public.users
  SET posts_used_this_week = GREATEST(COALESCE(posts_used_this_week, 0) - 1, 0),
      posts_used_this_month = GREATEST(COALESCE(posts_used_this_month, 0) - 1, 0)
  WHERE id = p_user;
$$ LANGUAGE sql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.consume_post_quota(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_post_quota(UUID) FROM PUBLIC, anon, authenticated;
