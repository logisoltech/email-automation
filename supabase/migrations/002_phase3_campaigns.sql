-- Phase 3: campaigns + scheduling support

create type campaign_status as enum ('draft', 'scheduled', 'sent', 'failed');

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  subject text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  recipients text[] not null default '{}',
  status campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  ai_provider text,
  ai_prompt text,
  error_message text,
  created_at timestamptz not null default now()
);

create index campaigns_status_scheduled_idx on campaigns (status, scheduled_at);
create index campaigns_created_at_idx on campaigns (created_at desc);

alter table campaigns enable row level security;

create policy "Authenticated users can read campaigns"
  on campaigns for select to authenticated using (true);

create policy "Authenticated users can insert campaigns"
  on campaigns for insert to authenticated with check (true);

create policy "Authenticated users can update campaigns"
  on campaigns for update to authenticated using (true);

create policy "Authenticated users can delete campaigns"
  on campaigns for delete to authenticated using (true);

alter table emails add column if not exists campaign_id uuid references campaigns (id) on delete set null;

create index if not exists emails_scheduled_idx on emails (status, scheduled_at)
  where status = 'scheduled';
