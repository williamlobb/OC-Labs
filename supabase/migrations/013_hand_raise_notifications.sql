-- Persist one-time hand-raise notifications and tighten membership visibility rules.

CREATE TABLE IF NOT EXISTS public.project_hand_raise_notifications (
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notified_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_hand_raise_notifications ENABLE ROW LEVEL SECURITY;

-- No anon policies by design: only service-role flows should touch notification markers.

DROP POLICY IF EXISTS "read project members" ON public.project_members;
CREATE POLICY "read project members" ON public.project_members
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      role <> 'interested'
      OR user_id = auth.uid()
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

DROP POLICY IF EXISTS "leave own membership" ON public.project_members;
CREATE POLICY "leave own membership" ON public.project_members
  FOR DELETE USING (user_id = auth.uid());
