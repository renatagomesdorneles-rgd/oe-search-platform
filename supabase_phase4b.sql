-- ============================================================
-- Support for historical Greenhouse import
-- Run as a NEW query in Supabase SQL Editor
-- ============================================================

-- Allow candidates without a real email (placeholder format)
-- No schema change needed since email is already text — we just
-- generate placeholder values like "no-email+<candidate_id>@import.local"

-- Add a free-text field for the original Greenhouse rejection reason
alter table public.candidate_engagements
  add column if not exists import_rejection_note text;

-- Flag to know which candidates came from historical import without real email
alter table public.candidates
  add column if not exists has_placeholder_email boolean default false;
