alter table public.updates
  add column if not exists author_name text;

-- Backfill from users table
update public.updates u
set author_name = coalesce(usr.name, 'Unknown')
from public.users usr
where u.author_id = usr.id
  and u.author_name is null;

-- Rows with no author_id default to 'Omnia Agent'
update public.updates
set author_name = 'Omnia Agent'
where author_name is null;
