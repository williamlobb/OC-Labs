alter table public.context_blocks
  add column if not exists author_name text,
  add column if not exists attachment_name text,
  add column if not exists attachment_path text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

update public.context_blocks cb
set author_name = coalesce(u.name, 'Unknown')
from public.users u
where cb.author_id = u.id
  and cb.author_name is null;

update public.context_blocks
set author_name = 'Unknown'
where author_name is null;

alter table public.context_blocks
  alter column author_name set not null;

alter table public.context_blocks
  add constraint context_blocks_attachment_columns_consistent
  check (
    (attachment_name is null and attachment_path is null and attachment_mime_type is null and attachment_size_bytes is null)
    or
    (
      attachment_name is not null
      and attachment_path is not null
      and attachment_mime_type is not null
      and attachment_size_bytes is not null
      and attachment_size_bytes > 0
    )
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('context-block-attachments', 'context-block-attachments', true, 20971520)
on conflict (id) do nothing;

create policy "read context attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'context-block-attachments');

create policy "insert context attachments" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'context-block-attachments'
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'contributor')
    )
  );

create policy "update context attachments" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'context-block-attachments'
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'contributor')
    )
  )
  with check (
    bucket_id = 'context-block-attachments'
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'contributor')
    )
  );

create policy "delete context attachments" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'context-block-attachments'
    and exists (
      select 1
      from public.project_members pm
      where pm.project_id::text = split_part(name, '/', 1)
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'contributor')
    )
  );
