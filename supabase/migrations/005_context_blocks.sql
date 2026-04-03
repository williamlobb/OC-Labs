create table public.context_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  author_id uuid references public.users(id),
  title text not null,
  body text not null,
  block_type text default 'general',
  version integer default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.context_blocks enable row level security;

create policy "read context blocks" on public.context_blocks
  for select using (auth.role() = 'authenticated');

create policy "write context blocks" on public.context_blocks
  for all using (
    exists (
      select 1 from public.project_members
      where project_id = context_blocks.project_id
        and user_id = auth.uid()
        and role in ('owner', 'contributor')
    )
  );
