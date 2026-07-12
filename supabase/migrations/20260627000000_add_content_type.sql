-- Supabase Migration: Add content_type to posts table
ALTER TABLE public.posts ADD COLUMN content_type TEXT DEFAULT 'post' CHECK (content_type IN ('post', 'article'));
