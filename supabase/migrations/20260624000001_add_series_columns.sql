-- Add series columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS series_id UUID;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS series_index INT;
