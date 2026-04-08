-- Create platform_role enum
CREATE TYPE platform_role AS ENUM ('user', 'power_user');

-- Add platform_role column to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_role platform_role NOT NULL DEFAULT 'user';

-- Create role_invitations table
CREATE TABLE IF NOT EXISTS public.role_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  platform_role platform_role,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  project_role member_role,
  invited_by uuid REFERENCES public.users(id),
  token text UNIQUE NOT NULL,
  accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.role_invitations ENABLE ROW LEVEL SECURITY;

-- RLS for role_invitations
CREATE POLICY "power_user or own invitations" ON public.role_invitations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
    OR email = auth.jwt()->>'email'
  );

CREATE POLICY "power_user insert invitations" ON public.role_invitations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
  );

-- Allow users to accept their own pending invitation (set accepted_at)
-- Route handler must additionally verify token matches before calling this
CREATE POLICY "accept own invitation" ON public.role_invitations
  FOR UPDATE
  USING (email = auth.jwt()->>'email' AND accepted_at IS NULL)
  WITH CHECK (email = auth.jwt()->>'email' AND accepted_at IS NOT NULL);

-- Allow power_user to manage (delete/revoke) invitations
CREATE POLICY "power_user manage invitations" ON public.role_invitations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
  );

-- Drop old write projects policy (covered all DML via FOR ALL)
DROP POLICY IF EXISTS "write projects" ON public.projects;

-- Replace with three granular policies
CREATE POLICY "power_user insert projects" ON public.projects
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
  );

CREATE POLICY "owner or power_user update projects" ON public.projects
  FOR UPDATE USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
  );

CREATE POLICY "owner or power_user delete projects" ON public.projects
  FOR DELETE USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
  );

-- Update write updates policy to include tech_lead
DROP POLICY IF EXISTS "write updates" ON public.updates;

CREATE POLICY "write updates" ON public.updates
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = updates.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'contributor', 'tech_lead')
    )
  );

-- Update join policy on project_members to support power_user and owner managing members
DROP POLICY IF EXISTS "join" ON public.project_members;

CREATE POLICY "join or manage members" ON public.project_members
  FOR INSERT WITH CHECK (
    (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
    )
    -- Self-joining users cannot claim owner role; only power_user or project owner can assign it
    AND (
      role != 'owner'
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND platform_role = 'power_user')
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
    )
  );

-- CRITICAL: Prevent privilege escalation via the existing "update own user" policy.
-- The existing policy (migration 001) has no column restriction, so without this fix
-- any user could self-promote to power_user. Drop and recreate with platform_role locked.
DROP POLICY IF EXISTS "update own user" ON public.users;
CREATE POLICY "update own user" ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- platform_role must remain unchanged; only service-role client (supabaseAdmin) may write it
    AND platform_role = (SELECT platform_role FROM public.users WHERE id = auth.uid())
  );

-- Seed power users (no-op if users don't exist yet)
UPDATE public.users SET platform_role = 'power_user'
WHERE email IN ('will.lobb@theoc.ai', 'will@theoc.ai');

-- Seed role_invitations for power users (so auth callback picks up on first login)
INSERT INTO public.role_invitations (email, platform_role, token)
VALUES
  ('will.lobb@theoc.ai', 'power_user', encode(gen_random_bytes(32), 'hex')),
  ('will@theoc.ai', 'power_user', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT DO NOTHING;
