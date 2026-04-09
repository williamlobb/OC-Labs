-- Restore SELECT visibility for project_members under RLS.
-- This powers assignee dropdown/member-list queries in the Plan view.
-- Access is limited to:
-- 1) users who are members of the same project,
-- 2) the project owner, or
-- 3) power users.

CREATE OR REPLACE FUNCTION public.is_project_member_for_read(
  target_project_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = target_project_id
      AND pm.user_id = target_user_id
  );
$$;

DROP POLICY IF EXISTS "read project members" ON public.project_members;
DROP POLICY IF EXISTS "project members select access" ON public.project_members;

CREATE POLICY "project members select access" ON public.project_members
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      public.is_project_member_for_read(project_members.project_id, auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = project_members.project_id
          AND p.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.platform_role = 'power_user'
      )
    )
  );
