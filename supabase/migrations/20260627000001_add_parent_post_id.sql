-- Supabase Migration: Add parent_post_id column to posts table to link promotional posts to parent articles
ALTER TABLE public.posts ADD COLUMN parent_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;
