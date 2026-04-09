-- Replace legacy task write policy with granular RBAC parity policies.
-- App parity target:
-- - power_user can write tasks project-wide
-- - project members with owner|contributor|tech_lead can write tasks
-- - observer|interested remain read-only

DROP POLICY IF EXISTS "write tasks" ON public.tasks;

CREATE POLICY "insert tasks" ON public.tasks
  FOR INSERT
  WITH CHECK (
    (
      EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = auth.uid()
          AND platform_role = 'power_user'
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members
        WHERE project_id = tasks.project_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'contributor', 'tech_lead')
      )
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "update tasks" ON public.tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND platform_role = 'power_user'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'contributor', 'tech_lead')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND platform_role = 'power_user'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'contributor', 'tech_lead')
    )
  );

CREATE POLICY "delete tasks" ON public.tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND platform_role = 'power_user'
    )
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE project_id = tasks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'contributor', 'tech_lead')
    )
  );
