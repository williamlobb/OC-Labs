-- Atomically increment vote_count and return the new value
create or replace function increment_vote_count(project_id uuid)
returns integer
language sql
security definer
as $$
  update public.projects
  set vote_count = vote_count + 1
  where id = project_id
  returning vote_count;
$$;

-- Atomically decrement vote_count (floor at 0) and return the new value
create or replace function decrement_vote_count(project_id uuid)
returns integer
language sql
security definer
as $$
  update public.projects
  set vote_count = greatest(vote_count - 1, 0)
  where id = project_id
  returning vote_count;
$$;
