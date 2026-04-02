-- supabase/seed.sql
-- Launch seed data: 7 projects, 8 team members
-- Run after migrations: supabase db seed

-- Seed users (CoWork will overwrite name/title/brand/photo on first login)
insert into public.users (id, email, name, title, brand) values
  ('00000001-0000-0000-0000-000000000001', 'will.lobb@theoc.ai',       'Will Lobb',       'Founder',              'Omnia Collective'),
  ('00000001-0000-0000-0000-000000000002', 'user2@theoc.ai',           'Team Member 2',   'Strategy Director',    'Omnia Collective'),
  ('00000001-0000-0000-0000-000000000003', 'user3@theonset.com',        'Team Member 3',   'Creative Lead',        'The Onset'),
  ('00000001-0000-0000-0000-000000000004', 'user4@elysiumdigital.com',  'Team Member 4',   'Tech Lead',            'Elysium Digital'),
  ('00000001-0000-0000-0000-000000000005', 'user5@edgered.com',         'Team Member 5',   'Growth Lead',          'EdgeRed'),
  ('00000001-0000-0000-0000-000000000006', 'user6@boundinteractive.com','Team Member 6',   'Product Designer',     'Bound Interactive'),
  ('00000001-0000-0000-0000-000000000007', 'user7@aidecisions.com',     'Team Member 7',   'AI Engineer',          'AI Decisions'),
  ('00000001-0000-0000-0000-000000000008', 'user8@theoc.ai',            'Team Member 8',   'Operations Manager',   'Omnia Collective')
on conflict (id) do nothing;

-- Seed projects
insert into public.projects (id, title, summary, status, brand, owner_id, skills_needed, needs_help, vote_count) values
  ('10000001-0000-0000-0000-000000000001',
   'OC Labs',
   'Internal project discovery and collaboration board for the Omnia Collective.',
   'In progress', 'Omnia Collective',
   '00000001-0000-0000-0000-000000000001',
   array['Next.js','Supabase','TypeScript'], false, 3),

  ('10000001-0000-0000-0000-000000000002',
   'Ombook',
   'Internal team directory and profile hub powered by CoWork/LinkedIn data.',
   'In progress', 'Omnia Collective',
   '00000001-0000-0000-0000-000000000001',
   array['React','Design','API'], false, 5),

  ('10000001-0000-0000-0000-000000000003',
   'Brand Playbook Generator',
   'AI-assisted tool to generate brand guidelines from a brief.',
   'Idea', 'The Onset',
   '00000001-0000-0000-0000-000000000003',
   array['AI','Design','Copywriting'], true, 4),

  ('10000001-0000-0000-0000-000000000004',
   'Client Reporting Dashboard',
   'Unified reporting view across all client campaigns.',
   'Needs help', 'Elysium Digital',
   '00000001-0000-0000-0000-000000000004',
   array['Data','React','Charts'], true, 2),

  ('10000001-0000-0000-0000-000000000005',
   'Growth Experiment Tracker',
   'Log, score, and share growth experiments across brands.',
   'Idea', 'EdgeRed',
   '00000001-0000-0000-0000-000000000005',
   array['Product','Analytics'], false, 1),

  ('10000001-0000-0000-0000-000000000006',
   'Component Library v2',
   'Rebuild the shared design system with updated tokens and Storybook docs.',
   'Paused', 'Bound Interactive',
   '00000001-0000-0000-0000-000000000006',
   array['Design Systems','React','Storybook'], false, 6),

  ('10000001-0000-0000-0000-000000000007',
   'AI Decision Logger',
   'Tool to log, review and audit AI-assisted decisions across the collective.',
   'In progress', 'AI Decisions',
   '00000001-0000-0000-0000-000000000007',
   array['AI','TypeScript','Compliance'], false, 7)
on conflict (id) do nothing;

-- Seed project members (owners)
insert into public.project_members (project_id, user_id, role) values
  ('10000001-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000001', 'owner'),
  ('10000001-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000001', 'owner'),
  ('10000001-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000003', 'owner'),
  ('10000001-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000004', 'owner'),
  ('10000001-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000005', 'owner'),
  ('10000001-0000-0000-0000-000000000006', '00000001-0000-0000-0000-000000000006', 'owner'),
  ('10000001-0000-0000-0000-000000000007', '00000001-0000-0000-0000-000000000007', 'owner')
on conflict do nothing;
