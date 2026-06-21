-- Migration: Add account_type and unique constraint to support LinkedIn Pages
ALTER TABLE public.linkedin_accounts ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'personal' CHECK (account_type IN ('personal', 'organization'));

-- Create unique index to handle upserts safely on conflict
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_accounts_user_profile ON public.linkedin_accounts(user_id, linkedin_profile_id);
