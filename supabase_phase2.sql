-- ============================================================
-- OE Consulting Search Platform — Phase 2 Schema Additions
-- Run this as a NEW query in Supabase SQL Editor
-- ============================================================

-- Storage policies for documents bucket
create policy "documents_upload" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents_read" on storage.objects
  for select using (bucket_id = 'documents' and auth.role() = 'authenticated');

-- Allow public (unauthenticated) inserts for application form submissions
create policy "candidates_public_insert" on public.candidates
  for insert with check (true);

create policy "candidate_engagements_public_insert" on public.candidate_engagements
  for insert with check (true);

-- Allow public read of engagement data needed to render the application form
create policy "engagements_public_read" on public.engagements
  for select using (true);

create policy "assessment_criteria_public_read" on public.assessment_criteria
  for select using (true);

create policy "form_questions_public_read" on public.engagement_form_questions
  for select using (true);

-- Prospects table
alter table public.prospects enable row level security;
create policy "prospects_all" on public.prospects for all using (auth.role() = 'authenticated');
