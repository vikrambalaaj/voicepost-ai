-- Supabase Migration: Add section_index to post_images to support section-specific images in articles
ALTER TABLE public.post_images ADD COLUMN section_index INT;
