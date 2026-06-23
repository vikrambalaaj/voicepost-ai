-- Migration: Add reply_draft column to post_comments table
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS reply_draft TEXT;
