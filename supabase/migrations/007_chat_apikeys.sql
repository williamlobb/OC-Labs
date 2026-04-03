create table public.project_chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  role text not null,
  content text not null,
  author_id uuid references public.users(id),
  created_at timestamp with time zone default now()
);

alter table public.project_chat_messages enable row level security;

create policy "read chat" on public.project_chat_messages
  for select using (auth.role() = 'authenticated');

create policy "write chat" on public.project_chat_messages
  for insert with check (author_id = auth.uid());

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  key_hash text not null unique,
  label text,
  created_at timestamp with time zone default now(),
  last_used_at timestamp with time zone
);

alter table public.api_keys enable row level security;

create policy "manage own api keys" on public.api_keys
  for all using (user_id = auth.uid());
