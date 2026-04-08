-- Run OUTSIDE a transaction because ALTER TYPE ... ADD VALUE cannot run in a transaction
-- Supabase: set autocommit for this migration
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'tech_lead';
