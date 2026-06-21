-- Supabase Migration: Init Schema

-- Create schema helper functions
CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY, -- references auth.users(id) via Supabase Auth trigger
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  industry TEXT,
  job_title TEXT,
  company_name TEXT,
  target_audience TEXT,
  keywords TEXT[] DEFAULT '{}',
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'agency')),
  plan_interval TEXT,
  plan_expires_at TIMESTAMPTZ,
  posts_used_this_week INT DEFAULT 0,
  posts_used_this_month INT DEFAULT 0,
  ai_images_used_this_week INT DEFAULT 0,
  ai_images_used_this_month INT DEFAULT 0,
  posts_limit_weekly INT DEFAULT 3,
  posts_limit_monthly INT DEFAULT 0,
  ai_images_limit_weekly INT DEFAULT 3,
  week_reset_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  month_reset_at TIMESTAMPTZ,
  last_used_style_id TEXT,
  last_used_style_type TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trigger_update_users
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();

-- Create Admin role checker
CREATE OR REPLACE FUNCTION public.check_admin_role()
RETURNS BOOLEAN SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- 2. linkedin_accounts table
CREATE TABLE public.linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linkedin_profile_id TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted using Vault or custom key in API
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_name TEXT,
  profile_headline TEXT,
  profile_picture_url TEXT,
  follower_count INT DEFAULT 0,
  posts_scraped_count INT DEFAULT 0,
  scraping_status TEXT DEFAULT 'pending'
    CHECK (scraping_status IN ('pending', 'running', 'complete', 'token_expired', 'permission_error', 'error', 'low_data')),
  low_data BOOLEAN DEFAULT false,
  last_scraped_at TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. style_profiles table
CREATE TABLE public.style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  style_json JSONB NOT NULL,
  posts_analyzed_count INT DEFAULT 0,
  last_analyzed_at TIMESTAMPTZ,
  user_confirmed BOOLEAN DEFAULT false,
  sample_post TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. expert_styles table
CREATE TABLE public.expert_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT,
  best_for TEXT[],
  description TEXT,
  style_json JSONB NOT NULL,
  example_post TEXT,
  sort_order INT DEFAULT 0,
  enabled BOOLEAN DEFAULT true
);

-- 5. custom_styles table
CREATE TABLE public.custom_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('paste', 'sliders')),
  style_json JSONB NOT NULL,
  sample_post TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. user_posts_raw table
CREATE TABLE public.user_posts_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linkedin_account_id UUID REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  linkedin_post_id TEXT NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  linkedin_account_id UUID REFERENCES public.linkedin_accounts(id) ON DELETE SET NULL,
  transcript_corrected TEXT,
  post_content TEXT,
  hashtags TEXT[] DEFAULT '{}',
  style_type TEXT CHECK (style_type IN ('own', 'expert', 'custom', 'blend')),
  style_id TEXT, -- Expert ID or Custom Style UUID
  blend_config JSONB DEFAULT '{}'::jsonb,
  style_match_score INT CHECK (style_match_score BETWEEN 1 AND 10),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'pending_approval', 'approved', 'rejected', 'scheduled', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  linkedin_post_id TEXT,
  linkedin_post_url TEXT,
  agent_thoughts TEXT,
  current_revision INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trigger_update_posts
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();

-- 8. post_revisions table
CREATE TABLE public.post_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  revision_number INT NOT NULL,
  post_content TEXT,
  hashtags TEXT[] DEFAULT '{}',
  feedback_given TEXT,
  changes_made TEXT[] DEFAULT '{}',
  provider_used TEXT,
  model_used TEXT,
  style_match_score INT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. post_images table
CREATE TABLE public.post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('search', 'ai', 'upload')),
  url TEXT NOT NULL,
  storage_path TEXT,
  thumbnail_url TEXT,
  attribution TEXT,
  prompt_used TEXT,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. voice_recordings table
CREATE TABLE public.voice_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  transcript_raw TEXT,
  transcript_corrected TEXT,
  transcription_provider TEXT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. generation_events table
CREATE TABLE public.generation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id TEXT,
  post_id_hash TEXT, -- hashed post_id for security/anonymity
  use_case TEXT,
  provider_attempted TEXT[],
  provider_succeeded TEXT,
  model_used TEXT,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  total_latency_ms INT DEFAULT 0,
  attempt_count INT DEFAULT 1,
  fallback_count INT DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. user_sessions table
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ DEFAULT NOW(),
  device_type TEXT,
  ip_country TEXT,
  plan_at_time TEXT
);

-- 13. provider_configs table
CREATE TABLE public.provider_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key_encrypted TEXT,
  enabled BOOLEAN DEFAULT true,
  priority INT NOT NULL,
  daily_limit_override INT,
  rpm_limit_override INT,
  model_free TEXT,
  model_starter TEXT,
  model_pro TEXT,
  model_agency TEXT
);

-- 14. provider_usage_daily table
CREATE TABLE public.provider_usage_daily (
  provider_id TEXT REFERENCES public.provider_configs(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  request_count INT DEFAULT 0,
  token_count INT DEFAULT 0,
  PRIMARY KEY (provider_id, date)
);

-- 15. api_keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  allowed_endpoints TEXT[] DEFAULT '{}',
  rate_limit_rpm INT DEFAULT 60,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. admin_audit_log table
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES public.users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_user_id UUID,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS & PRIVACY ENFORCEMENT VIEWS
-- Admins should never see raw post_content, transcripts, audio recordings, or style DNA profiles.
-- Create privacy views for Admins to access operational metrics without violating privacy.

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

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.style_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_posts_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- CREATE RLS POLICIES

-- Users
CREATE POLICY users_owner_all ON public.users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY users_admin_read ON public.users
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- LinkedIn Accounts
CREATE POLICY linkedin_owner_all ON public.linkedin_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY linkedin_admin_read ON public.linkedin_accounts
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- Style Profiles
CREATE POLICY style_owner_all ON public.style_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY style_admin_read ON public.style_profiles
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- Expert Styles (Seeded - read all, write admin)
CREATE POLICY expert_styles_read ON public.expert_styles
  FOR SELECT TO public USING (enabled = true);

CREATE POLICY expert_styles_admin ON public.expert_styles
  FOR ALL TO authenticated USING (public.check_admin_role());

-- Custom Styles
CREATE POLICY custom_owner_all ON public.custom_styles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- User Posts Raw
CREATE POLICY raw_posts_owner_all ON public.user_posts_raw
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Posts
CREATE POLICY posts_owner_all ON public.posts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY posts_admin_read ON public.posts
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- Post Revisions
CREATE POLICY revisions_owner_all ON public.post_revisions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_revisions.post_id AND posts.user_id = auth.uid()
    )
  );

-- Post Images
CREATE POLICY images_owner_all ON public.post_images
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_images.post_id AND posts.user_id = auth.uid()
    )
  );

-- Voice Recordings
CREATE POLICY recordings_owner_all ON public.voice_recordings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY recordings_admin_read ON public.voice_recordings
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- Generation Events
CREATE POLICY gen_events_owner_all ON public.generation_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY gen_events_admin ON public.generation_events
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- User Sessions
CREATE POLICY sessions_owner_all ON public.user_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_admin ON public.user_sessions
  FOR SELECT TO authenticated USING (public.check_admin_role());

-- Provider Configs (Admin only)
CREATE POLICY providers_admin ON public.provider_configs
  FOR ALL TO authenticated USING (public.check_admin_role());

-- Provider Usage Daily (Admin only)
CREATE POLICY usage_daily_admin ON public.provider_usage_daily
  FOR ALL TO authenticated USING (public.check_admin_role());

-- API Keys
CREATE POLICY api_keys_owner_all ON public.api_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Seed Expert Styles
INSERT INTO public.expert_styles (id, name, handle, best_for, description, style_json, example_post, sort_order)
VALUES
(
  'justin_welsh',
  'Justin Welsh',
  '@JustinWelsh',
  ARRAY['thought leadership', 'solopreneurship', 'growth'],
  'Structured, concise, spacing-heavy style built around actionable growth blueprints and frameworks.',
  '{
    "avg_post_length_words": 150,
    "tone_descriptor": "authoritative, educational, structured",
    "uses_emojis": false,
    "emoji_frequency": "none",
    "uses_line_breaks_for_drama": true,
    "sentence_length_pattern": "short-short-long",
    "opener_patterns": ["Most people focus on the wrong things.", "Here is the simple blueprint to..."],
    "avoided_corporate_words": ["leverage", "delve", "game-changer", "transformative"],
    "cta_style": "minimal, link in comment",
    "hashtag_style": "none",
    "storytelling_ratio": 0.3
  }'::jsonb,
  'Most people focus on the wrong things.
They buy tools they don''t need.
They plan for months without launching.
They worry about logo designs instead of sales.

Here is the 3-step blueprint I used to build a $5M one-person business:
1. Sell a service first to prove demand.
2. Productize it into a digital template.
3. Automate onboarding and customer support.

Simple wins. Action beats planning every single time.',
  1
),
(
  'lara_acosta',
  'Lara Acosta',
  '@LaraAcosta',
  ARRAY['personal branding', 'social media strategy', 'linkedin growth'],
  'High energy, conversational, self-reflective style. Focuses on personal branding, mistakes made, and practical advice.',
  '{
    "avg_post_length_words": 120,
    "tone_descriptor": "encouraging, friendly, self-reflective",
    "uses_emojis": true,
    "emoji_frequency": "low",
    "uses_line_breaks_for_drama": true,
    "sentence_length_pattern": "conversational, varied",
    "opener_patterns": ["I spent 3 years trying to figure out LinkedIn.", "Honestly, personal branding is just..."],
    "avoided_corporate_words": ["synergy", "paradigm shift", "disruptive"],
    "cta_style": "engaging question at the end",
    "hashtag_style": "none",
    "storytelling_ratio": 0.6
  }'::jsonb,
  'I spent 3 years trying to figure out LinkedIn.
Honestly, it boils down to one simple thing:
Being helpful, not fancy.

No one cares about your complex theories.
They care about how you solved a real problem they are facing today.

Be human. Talk like you''re buying a coffee. ☕
What''s stopping you from writing your first post today?',
  2
),
(
  'alex_hormozi',
  'Alex Hormozi',
  '@AlexHormozi',
  ARRAY['sales', 'scaling', 'acquisition'],
  'Punchy, ultra-short sentences, high-impact storytelling, highly pragmatic business advice.',
  '{
    "avg_post_length_words": 110,
    "tone_descriptor": "direct, pragmatic, high-conviction",
    "uses_emojis": false,
    "emoji_frequency": "none",
    "uses_line_breaks_for_drama": true,
    "sentence_length_pattern": "ultra-short, punchy",
    "opener_patterns": ["You don''t need more leads. You need...", "I noticed something about poor entrepreneurs."],
    "avoided_corporate_words": ["empower", "spearhead", "seamlessly"],
    "cta_style": "none, direct statement",
    "hashtag_style": "none",
    "storytelling_ratio": 0.5
  }'::jsonb,
  'You don''t need more leads.
You need to charge more for what you already sell.

If you double your price, you only need half the clients to make the same money.
And your clients will actually value your service more.

Price is a proxy for quality.
Stop competing on cheap. Compete on value.',
  3
),
(
  'sahil_bloom',
  'Sahil Bloom',
  '@SahilBloom',
  ARRAY['curiosity', 'productivity', 'habits'],
  'Structured essays, frameworks, visual breakdowns, intellectual tone.',
  '{
    "avg_post_length_words": 200,
    "tone_descriptor": "intellectual, curious, structured",
    "uses_emojis": true,
    "emoji_frequency": "medium",
    "uses_line_breaks_for_drama": true,
    "sentence_length_pattern": "varied, essayistic",
    "opener_patterns": ["The Golden Rule of...", "Most people realize this too late:"],
    "avoided_corporate_words": ["cutting-edge", "synergy", "disruptive"],
    "cta_style": "newsletter signup",
    "hashtag_style": "minimal",
    "storytelling_ratio": 0.4
  }'::jsonb,
  'Most people realize this too late:
The quality of your life is determined by the quality of your daily habits.

If you change nothing, nothing changes. 🧠

Here are 3 micro-habits that take less than 5 minutes but return massive compounding dividends:
1. The 1-minute morning sun exposure.
2. The 3-sentence daily gratitude check.
3. The 2-minute review of your calendar before bed.

Build small. Win big.',
  4
);

-- Helper function to increment provider daily usage limits
CREATE OR REPLACE FUNCTION public.increment_provider_usage(
  p_id TEXT,
  p_date DATE,
  p_tokens INT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.provider_usage_daily (provider_id, date, request_count, token_count)
  VALUES (p_id, p_date, 1, p_tokens)
  ON CONFLICT (provider_id, date) DO UPDATE
  SET request_count = public.provider_usage_daily.request_count + 1,
      token_count = public.provider_usage_daily.token_count + p_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

