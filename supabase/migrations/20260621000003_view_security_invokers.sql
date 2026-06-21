-- Migration: Fix Security Definer Views by converting them to Security Invoker Views
-- and adding corresponding select policies for admins on the underlying tables.

-- 1. Add SELECT policies for admins on the underlying tables so security_invoker views can fetch data
CREATE POLICY posts_admin_read ON public.posts
  FOR SELECT TO authenticated USING (public.check_admin_role());

CREATE POLICY recordings_admin_read ON public.voice_recordings
  FOR SELECT TO authenticated USING (public.check_admin_role());

CREATE POLICY style_admin_read ON public.style_profiles
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- 2. Drop existing security definer views
DROP VIEW IF EXISTS public.admin_posts;
DROP VIEW IF EXISTS public.admin_voice_recordings;
DROP VIEW IF EXISTS public.admin_style_profiles;

-- 3. Recreate views with security_invoker = true
CREATE OR REPLACE VIEW public.admin_posts WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  linkedin_account_id,
  style_type,
  style_id,
  style_match_score,
  status,
  scheduled_at,
  published_at,
  current_revision,
  created_at,
  updated_at
FROM public.posts;

CREATE OR REPLACE VIEW public.admin_voice_recordings WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  post_id,
  storage_path,
  duration_seconds,
  transcription_provider,
  latency_ms,
  created_at
FROM public.voice_recordings;

CREATE OR REPLACE VIEW public.admin_style_profiles WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  posts_analyzed_count,
  last_analyzed_at,
  user_confirmed,
  created_at
FROM public.style_profiles;
