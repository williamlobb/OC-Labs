-- Add Jira Epic key column to projects table.
-- Populated asynchronously after project creation via the Jira API.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS jira_epic_key text;
