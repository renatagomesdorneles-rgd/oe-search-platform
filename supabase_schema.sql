-- ============================================================
-- OE Consulting Search Platform — Database Schema
-- Run this in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text check (role in ('admin', 'team_member')) default 'team_member',
  avatar_initials text,
  created_at timestamptz default now()
);

-- ============================================================
-- ENGAGEMENTS
-- ============================================================
create table public.engagements (
  id uuid default uuid_generate_v4() primary key,
  client_name text not null,
  role_title text not null,
  location text,
  start_date date,
  target_close_date date,
  status text check (status in ('active', 'on_hold', 'closed')) default 'active',
  job_posting_text text,
  application_form_slug text unique,
  relocation_required boolean default false,
  compensation_field_enabled boolean default false,
  instantly_campaign_id text,
  eblast_content text,
  eblast_date date,
  acknowledgment_email_template text,
  project_summary jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Assessment criteria per engagement (replaces "Key Pillars")
create table public.assessment_criteria (
  id uuid default uuid_generate_v4() primary key,
  engagement_id uuid references public.engagements(id) on delete cascade,
  name text not null,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- Custom form questions per engagement
create table public.engagement_form_questions (
  id uuid default uuid_generate_v4() primary key,
  engagement_id uuid references public.engagements(id) on delete cascade,
  question_text text not null,
  question_type text check (question_type in ('text', 'yes_no', 'multiple_choice')) default 'text',
  options jsonb,
  display_order integer default 0
);

-- Team members assigned to an engagement
create table public.engagement_team (
  engagement_id uuid references public.engagements(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (engagement_id, profile_id)
);

-- ============================================================
-- PROSPECTS
-- ============================================================
create table public.prospects (
  id uuid default uuid_generate_v4() primary key,
  engagement_id uuid references public.engagements(id) on delete cascade,
  full_name text not null,
  email text,
  linkedin_url text,
  current_title text,
  current_organization text,
  location text,
  source text check (source in ('linkedin_recruiter', 'referral', 'research', 'other')) default 'linkedin_recruiter',
  stage text check (stage in ('not_contacted', 'sequence_active', 'expressed_interest', 'no_response', 'bounced_opted_out', 'converted')) default 'not_contacted',
  enroll_in_sequence boolean default true,
  outreach_step integer default 0,
  email_opened boolean default false,
  converted boolean default false,
  converted_at timestamptz,
  linked_candidate_id uuid,
  gender_estimated text,
  race_ethnicity_estimated text[],
  notes text,
  added_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CANDIDATES (universal record)
-- ============================================================
create table public.candidates (
  id uuid default uuid_generate_v4() primary key,
  full_name text not null,
  email text not null unique,
  linkedin_url text,
  current_title text,
  current_organization text,
  zip_code text,
  resume_url text,
  cover_letter_url text,
  entry_type text check (entry_type in ('converted_from_prospect', 'inbound_application')) default 'inbound_application',
  linked_prospect_id uuid references public.prospects(id),
  gender_self_reported text,
  race_ethnicity_self_reported text[],
  date_applied timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add forward reference from prospects to candidates
alter table public.prospects
  add constraint fk_prospect_candidate
  foreign key (linked_candidate_id) references public.candidates(id);

-- ============================================================
-- CANDIDATE ENGAGEMENTS (engagement-specific fields)
-- ============================================================
create table public.candidate_engagements (
  id uuid default uuid_generate_v4() primary key,
  candidate_id uuid references public.candidates(id) on delete cascade,
  engagement_id uuid references public.engagements(id) on delete cascade,
  pipeline_stage integer check (pipeline_stage between 1 and 10) default 1,
  -- stage names: 1=Application Received, 2=Application Review, 3=Screened 1st Interview,
  -- 4=Screened 2nd Interview, 5=Pending Client Presentation, 6=Submitted to Client,
  -- 7=Client Interview, 8=Reference Check, 9=Offer Extended, 10=Placed
  not_proceeding boolean default false,
  not_proceeding_reason text check (not_proceeding_reason in (
    'does_not_meet_qualifications',
    'insufficient_experience',
    'location_relocation',
    'withdrew',
    'other'
  )),
  not_proceeding_notes text,
  not_proceeding_at timestamptz,
  rejection_email_sent boolean default false,
  rejection_email_sent_at timestamptz,
  acknowledgment_email_sent boolean default false,
  acknowledgment_email_sent_at timestamptz,
  -- aging
  stage_entered_at timestamptz default now(),
  -- application review
  application_review_notes text,
  -- interview fields
  interview_1_date date,
  interview_1_conducted_by uuid references public.profiles(id),
  next_step_sent_1 boolean default false,
  next_step_sent_1_at timestamptz,
  overall_recommendation text check (overall_recommendation in ('strong_yes', 'yes', 'maybe', 'no')),
  interview_2_date date,
  next_step_sent_2 boolean default false,
  next_step_sent_2_at timestamptz,
  interview_2_notes text,
  client_lead_notes text,
  client_feedback text,
  reference_check_notes text,
  relocation_willingness text check (relocation_willingness in ('yes', 'no', 'open_to_discuss')),
  compensation_expectations text,
  general_notes text,
  custom_question_responses jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(candidate_id, engagement_id)
);

-- ============================================================
-- STAGE HISTORY (audit log)
-- ============================================================
create table public.stage_history (
  id uuid default uuid_generate_v4() primary key,
  candidate_engagement_id uuid references public.candidate_engagements(id) on delete cascade,
  from_stage integer,
  to_stage integer,
  changed_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- ASSESSMENT CRITERIA SCORES (scorecard)
-- ============================================================
create table public.scorecard_entries (
  id uuid default uuid_generate_v4() primary key,
  candidate_engagement_id uuid references public.candidate_engagements(id) on delete cascade,
  criterion_id uuid references public.assessment_criteria(id) on delete cascade,
  rating integer check (rating between 1 and 5),
  narrative text,
  scored_by uuid references public.profiles(id),
  scored_at timestamptz default now(),
  unique(candidate_engagement_id, criterion_id)
);

-- ============================================================
-- WORKPLAN TASKS
-- ============================================================
create table public.workplan_tasks (
  id uuid default uuid_generate_v4() primary key,
  engagement_id uuid references public.engagements(id) on delete cascade,
  phase text not null,
  task_name text not null,
  default_lead text,
  status text check (status in ('to_do', 'done', 'na')) default 'to_do',
  assigned_to uuid references public.profiles(id),
  due_date date,
  notes text,
  display_order integer default 0,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.engagements enable row level security;
alter table public.assessment_criteria enable row level security;
alter table public.engagement_form_questions enable row level security;
alter table public.engagement_team enable row level security;
alter table public.prospects enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_engagements enable row level security;
alter table public.stage_history enable row level security;
alter table public.scorecard_entries enable row level security;
alter table public.workplan_tasks enable row level security;

-- Profiles: users can read all, update own
create policy "profiles_read" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

-- All authenticated users can read/write engagements and related data
create policy "engagements_all" on public.engagements for all using (auth.role() = 'authenticated');
create policy "assessment_criteria_all" on public.assessment_criteria for all using (auth.role() = 'authenticated');
create policy "form_questions_all" on public.engagement_form_questions for all using (auth.role() = 'authenticated');
create policy "engagement_team_all" on public.engagement_team for all using (auth.role() = 'authenticated');
create policy "prospects_all" on public.prospects for all using (auth.role() = 'authenticated');
create policy "candidates_all" on public.candidates for all using (auth.role() = 'authenticated');
create policy "candidate_engagements_all" on public.candidate_engagements for all using (auth.role() = 'authenticated');
create policy "stage_history_all" on public.stage_history for all using (auth.role() = 'authenticated');
create policy "scorecard_entries_all" on public.scorecard_entries for all using (auth.role() = 'authenticated');
create policy "workplan_tasks_all" on public.workplan_tasks for all using (auth.role() = 'authenticated');

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger engagements_updated_at before update on public.engagements
  for each row execute procedure public.set_updated_at();
create trigger prospects_updated_at before update on public.prospects
  for each row execute procedure public.set_updated_at();
create trigger candidates_updated_at before update on public.candidates
  for each row execute procedure public.set_updated_at();
create trigger candidate_engagements_updated_at before update on public.candidate_engagements
  for each row execute procedure public.set_updated_at();

-- Auto-generate application form slug
create or replace function public.generate_form_slug()
returns trigger language plpgsql
as $$
begin
  if new.application_form_slug is null then
    new.application_form_slug = lower(
      regexp_replace(new.client_name, '[^a-zA-Z0-9]', '-', 'g') || '-' ||
      regexp_replace(new.role_title, '[^a-zA-Z0-9]', '-', 'g') || '-' ||
      substring(new.id::text, 1, 6)
    );
  end if;
  return new;
end;
$$;

create trigger engagements_form_slug before insert on public.engagements
  for each row execute procedure public.generate_form_slug();

-- ============================================================
-- DEFAULT WORKPLAN TEMPLATE FUNCTION
-- Call after creating an engagement to populate default tasks
-- ============================================================
create or replace function public.create_default_workplan(p_engagement_id uuid)
returns void language plpgsql
as $$
begin
  insert into public.workplan_tasks (engagement_id, phase, task_name, default_lead, display_order) values
  (p_engagement_id, 'Internal Preparation', 'Set up engagement folder (Google Drive)', 'PM', 1),
  (p_engagement_id, 'Internal Preparation', 'Create email alias', 'PM', 2),
  (p_engagement_id, 'Internal Preparation', 'Internal Launch Meeting', 'PM', 3),
  (p_engagement_id, 'Internal Preparation', 'Develop Research Q&A', 'Research Lead', 4),
  (p_engagement_id, 'Role Development', 'Launch Meeting deck', 'Client Lead', 5),
  (p_engagement_id, 'Role Development', 'Stakeholder interview guide', 'PM', 6),
  (p_engagement_id, 'Role Development', 'Stakeholder interviews', 'Client Lead / PM', 7),
  (p_engagement_id, 'Role Development', 'Materials request', 'PM', 8),
  (p_engagement_id, 'Role Development', 'Finalize Assessment Criteria', 'Client Lead', 9),
  (p_engagement_id, 'Role Development', 'Finalize job posting', 'Client Lead', 10),
  (p_engagement_id, 'Role Development', 'Activate application form', 'PM', 11),
  (p_engagement_id, 'Sourcing & Outreach', 'Establish sourcing strategies', 'Research Lead', 12),
  (p_engagement_id, 'Sourcing & Outreach', 'Set up Instantly campaign', 'Research Lead', 13),
  (p_engagement_id, 'Sourcing & Outreach', 'Outreach template created', 'Research Lead', 14),
  (p_engagement_id, 'Sourcing & Outreach', 'E-blast sent', 'PM', 15),
  (p_engagement_id, 'Pipeline Management', 'Interview design finalized', 'Team', 16),
  (p_engagement_id, 'Pipeline Management', 'IPR #1 deck', 'PM + Team', 17),
  (p_engagement_id, 'Pipeline Management', 'IPR #2 deck', 'PM + Team', 18),
  (p_engagement_id, 'Pipeline Management', 'Finalist Presentation deck', 'PM + Team', 19),
  (p_engagement_id, 'Closing', 'Reference checks completed', 'PM', 20),
  (p_engagement_id, 'Closing', 'All finalists closed (phone or email)', 'Client Lead / PM', 21),
  (p_engagement_id, 'Closing', 'Demographics tracker updated', 'PM', 22),
  (p_engagement_id, 'Closing', 'Project Summary completed', 'PM', 23),
  (p_engagement_id, 'Closing', 'Engagement marked Closed', 'PM', 24);
end;
$$;

-- ============================================================
-- PHASE 2 ADDITIONS
-- Run this as a second query in Supabase SQL Editor
-- ============================================================

-- Storage policy: authenticated users can upload to documents bucket
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_upload" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "documents_read" on storage.objects
  for select using (bucket_id = 'documents' and auth.role() = 'authenticated');

-- Public application form submissions (no auth required)
create policy "candidates_public_insert" on public.candidates
  for insert with check (true);

create policy "candidate_engagements_public_insert" on public.candidate_engagements
  for insert with check (true);

-- Allow public read of engagements for application form
create policy "engagements_public_read" on public.engagements
  for select using (true);

create policy "assessment_criteria_public_read" on public.assessment_criteria
  for select using (true);

create policy "form_questions_public_read" on public.engagement_form_questions
  for select using (true);
