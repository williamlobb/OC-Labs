-- Add moderation state for project submissions and tighten visibility.
-- Pending/rejected submissions are only visible to the owner and power users.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'project_submission_status'
  ) THEN
    CREATE TYPE project_submission_status AS ENUM ('pending_review', 'approved', 'rejected');
  END IF;
END
$$;

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS submission_status project_submission_status NOT NULL DEFAULT 'approved';

UPDATE public.projects
SET submission_status = 'approved'
WHERE submission_status IS NULL;

CREATE INDEX IF NOT EXISTS projects_submission_status_idx
  ON public.projects (submission_status);

-- Only approved projects are globally discoverable.
DROP POLICY IF EXISTS "read projects" ON public.projects;
CREATE POLICY "read projects" ON public.projects
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      submission_status = 'approved'
      OR owner_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.platform_role = 'power_user'
      )
    )
  );

-- All authenticated users can submit ideas, but only power users can publish immediately.
DROP POLICY IF EXISTS "power_user insert projects" ON public.projects;
CREATE POLICY "insert projects with moderation" ON public.projects
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND owner_id = auth.uid()
    AND (
      submission_status = 'pending_review'
      OR (
        submission_status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND u.platform_role = 'power_user'
        )
      )
    )
  );

-- Owners can edit their projects but cannot self-approve/reject via direct table writes.
CREATE OR REPLACE FUNCTION public.project_submission_status_unchanged(
  target_project_id uuid,
  proposed_status project_submission_status
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.submission_status = proposed_status
  FROM public.projects p
  WHERE p.id = target_project_id;
$$;

DROP POLICY IF EXISTS "owner or power_user update projects" ON public.projects;

CREATE POLICY "power_user update projects" ON public.projects
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.platform_role = 'power_user'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.platform_role = 'power_user'
    )
  );

CREATE POLICY "owner update projects without moderation change" ON public.projects
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND public.project_submission_status_unchanged(id, submission_status)
  );
