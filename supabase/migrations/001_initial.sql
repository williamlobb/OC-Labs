-- supabase/migrations/001_initial.sql

create extension if not exists "uuid-ossp";

create table public.users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  name text not null,
  title text,
  brand text,
  profile_photo_url text,
  linkedin_url text,
  github_username text,
  cowork_synced_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

create type project_status as enum ('Idea','In progress','Needs help','Paused','Shipped');

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  summary text,
  status project_status default 'Idea',
  brand text,
  owner_id uuid references public.users(id),
  github_repos text[] default '{}',
  skills_needed text[] default '{}',
  needs_help boolean default false,
  vote_count integer default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create type member_role as enum ('owner','contributor','interested','observer');

create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role member_role default 'interested',
  joined_at timestamp with time zone default now(),
  primary key (project_id, user_id)
);

create table public.votes (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  voted_at timestamp with time zone default now(),
  primary key (project_id, user_id)
);

create table public.updates (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade,
  author_id uuid references public.users(id),
  body text not null,
  milestone boolean default false,
  posted_at timestamp with time zone default now()
);

create table public.user_skills (
  user_id uuid references public.users(id) on delete cascade,
  skill text not null,
  source text default 'self',
  primary key (user_id, skill)
);

-- Indexes
create index on public.projects(status);
create index on public.projects(needs_help);
create index on public.projects using gin(skills_needed);
create index on public.user_skills(skill);

-- Row Level Security
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.votes enable row level security;
alter table public.updates enable row level security;
alter table public.user_skills enable row level security;

-- Users: authenticated users can read all profiles
create policy "read users" on public.users
  for select using (auth.role() = 'authenticated');

-- Users can update their own record
create policy "update own user" on public.users
  for update using (id = auth.uid());

-- Anyone authenticated can read projects
create policy "read projects" on public.projects
  for select using (auth.role() = 'authenticated');

-- Only owner or skunkworks_lead (Omnia Collective brand) can insert/update projects
create policy "write projects" on public.projects
  for all using (owner_id = auth.uid()
    or exists (select 1 from public.users
      where id = auth.uid() and brand = 'Omnia Collective'));

-- Authenticated users can vote
create policy "vote" on public.votes
  for all using (user_id = auth.uid());

-- Authenticated users can join
create policy "join" on public.project_members
  for all using (user_id = auth.uid());

-- Contributors can post updates
create policy "read updates" on public.updates
  for select using (auth.role() = 'authenticated');

create policy "write updates" on public.updates
  for insert with check (
    author_id = auth.uid() and
    exists (
      select 1 from public.project_members
      where project_id = updates.project_id
        and user_id = auth.uid()
        and role in ('owner','contributor')
    )
  );

-- Users can manage their own skills
create policy "manage own skills" on public.user_skills
  for all using (user_id = auth.uid());

create policy "read skills" on public.user_skills
  for select using (auth.role() = 'authenticated');
