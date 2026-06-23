-- ============================================================
-- OE Consulting Search Platform — Phase 3 SQL
-- Run this as a NEW query in Supabase SQL Editor
-- ============================================================

-- Ensure scorecard_entries policies are open
drop policy if exists "scorecard_entries_all" on public.scorecard_entries;
create policy "scorecard_entries_all" on public.scorecard_entries
  for all using (true) with check (true);

-- Ensure assessment_criteria policies are open
drop policy if exists "assessment_criteria_all" on public.assessment_criteria;
create policy "assessment_criteria_all" on public.assessment_criteria
  for all using (true) with check (true);
