create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  body text,
  status text default 'todo',
  assignee_id uuid references public.users(id),
  assigned_to_agent boolean default false,
  depends_on uuid[] default '{}',
  created_by uuid references public.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.tasks enable row level security;

create policy "read tasks" on public.tasks
  for select using (auth.role() = 'authenticated');

create policy "write tasks" on public.tasks
  for all using (
    exists (
      select 1 from public.project_members
      where project_id = tasks.project_id
        and user_id = auth.uid()
        and role in ('owner', 'contributor')
    )
  );
