-- Migration: Create post_comments table to support comment tracking and engagement replies.
CREATE TABLE IF NOT EXISTS post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    linkedin_comment_urn VARCHAR(255),
    commenter_name VARCHAR(100) NOT NULL,
    commenter_headline VARCHAR(255),
    comment_text TEXT NOT NULL,
    reply_text TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for fast lookup by post_id
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
