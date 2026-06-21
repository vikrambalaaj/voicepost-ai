-- Migration: Add region to users and create trending_topics table.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'Global';

CREATE TABLE IF NOT EXISTS public.trending_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry VARCHAR(100) NOT NULL,
    region VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_industry_region UNIQUE (industry, region)
);

-- Index for fast lookup of trend feeds by industry and region
CREATE INDEX IF NOT EXISTS idx_trending_topics_lookup ON public.trending_topics(industry, region, computed_at DESC);
