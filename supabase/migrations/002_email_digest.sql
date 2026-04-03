-- Add email digest opt-in column to users table
alter table public.users add column if not exists email_digest boolean default true;
