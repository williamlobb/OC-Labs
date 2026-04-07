alter table public.tasks
  add column jira_issue_key text,
  add column jira_issue_url text,
  add column jira_synced_at timestamp with time zone;

create index tasks_jira_issue_key_idx on public.tasks (jira_issue_key);
