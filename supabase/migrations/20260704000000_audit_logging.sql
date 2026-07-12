-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies if they already exist
DROP POLICY IF EXISTS audit_logs_owner_read ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_admin_all ON public.audit_logs;

-- Policies
CREATE POLICY audit_logs_owner_read ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY audit_logs_admin_all ON public.audit_logs
  FOR ALL TO authenticated USING (public.check_admin_role());
