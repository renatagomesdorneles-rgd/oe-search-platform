-- ============================================================
-- Clean up previous Greenhouse import before re-running
-- This removes candidate_engagements, candidates, and engagements
-- that came from the Greenhouse import (status = 'closed' and
-- created via the importer), so the next import starts fresh.
--
-- SAFE TO RUN: this does NOT touch your active Mott Foundation
-- search or any test data you created manually, as long as those
-- engagements are NOT set to status = 'closed'.
--
-- Run as a NEW query in Supabase SQL Editor
-- ============================================================

-- Step 1: Delete candidate_engagements tied to closed (imported) engagements
delete from public.candidate_engagements
where engagement_id in (
  select id from public.engagements where status = 'closed'
);

-- Step 2: Delete candidates that have no remaining candidate_engagements
-- (i.e. they only existed because of the import we're undoing)
delete from public.candidates
where id not in (
  select distinct candidate_id from public.candidate_engagements
);

-- Step 3: Delete the closed engagements themselves (and their workplan tasks)
delete from public.workplan_tasks
where engagement_id in (
  select id from public.engagements where status = 'closed'
);

delete from public.engagements
where status = 'closed';
