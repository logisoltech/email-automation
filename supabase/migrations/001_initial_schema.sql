-- Email Automation — initial schema (private Logisol tool)
-- Run in Supabase SQL Editor after creating your project.
-- Disable public signups: Authentication → Providers → Email → off "Enable sign ups"

create type email_status as enum ('draft', 'scheduled', 'sent', 'failed');

create table emails (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references auth.users (id) on delete set null,
  subject text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  recipients text[] not null default '{}',
  status email_status not null default 'draft',
  ai_provider text,
  ai_prompt text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index emails_created_at_idx on emails (created_at desc);
create index emails_status_idx on emails (status);

alter table emails enable row level security;

-- All authenticated allowlisted users share company data
create policy "Authenticated users can read emails"
  on emails for select
  to authenticated
  using (true);

create policy "Authenticated users can insert emails"
  on emails for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update emails"
  on emails for update
  to authenticated
  using (true);

create policy "Authenticated users can delete emails"
  on emails for delete
  to authenticated
  using (true);
