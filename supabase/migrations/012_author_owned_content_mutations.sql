-- Enforce author-owned mutation for updates and context blocks.
-- Users can still create content based on project-role permissions,
-- but only the original author can update or delete their own entries.

-- Context blocks: replace broad write policy with granular ownership policies.
DROP POLICY IF EXISTS "write context blocks" ON public.context_blocks;
DROP POLICY IF EXISTS "insert context blocks" ON public.context_blocks;
DROP POLICY IF EXISTS "update own context blocks" ON public.context_blocks;
DROP POLICY IF EXISTS "delete own context blocks" ON public.context_blocks;

CREATE POLICY "insert context blocks" ON public.context_blocks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = context_blocks.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'contributor', 'tech_lead')
    )
  );

CREATE POLICY "update own context blocks" ON public.context_blocks
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "delete own context blocks" ON public.context_blocks
  FOR DELETE
  USING (author_id = auth.uid());

-- Updates: keep existing insert policy, add ownership rules for mutation.
DROP POLICY IF EXISTS "update own updates" ON public.updates;
DROP POLICY IF EXISTS "delete own updates" ON public.updates;

CREATE POLICY "update own updates" ON public.updates
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "delete own updates" ON public.updates
  FOR DELETE
  USING (author_id = auth.uid());
