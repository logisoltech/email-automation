-- Lead import batches (website + SMM)

create type lead_batch_type as enum ('website', 'smm');
create type lead_batch_status as enum ('draft', 'generating', 'review', 'sending', 'completed', 'paused');
create type lead_row_status as enum ('pending', 'generated', 'queued', 'sent', 'failed', 'skipped');

create table lead_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  type lead_batch_type not null,
  name text not null,
  status lead_batch_status not null default 'draft',
  sends_per_hour int not null default 100,
  last_send_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references lead_batches (id) on delete cascade,
  sort_order int not null default 0,
  lead_date text,
  name text not null,
  country text,
  category text,
  emails text[] not null default '{}',
  phone text,
  project_description text,
  budget text,
  subject text,
  body_text text,
  body_html text,
  status lead_row_status not null default 'pending',
  error_message text,
  generated_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index lead_batches_status_idx on lead_batches (status);
create index lead_batches_created_at_idx on lead_batches (created_at desc);
create index leads_batch_id_idx on leads (batch_id);
create index leads_batch_status_idx on leads (batch_id, status);

alter table lead_batches enable row level security;
alter table leads enable row level security;

create policy "Authenticated users can read lead_batches"
  on lead_batches for select to authenticated using (true);
create policy "Authenticated users can insert lead_batches"
  on lead_batches for insert to authenticated with check (true);
create policy "Authenticated users can update lead_batches"
  on lead_batches for update to authenticated using (true);
create policy "Authenticated users can delete lead_batches"
  on lead_batches for delete to authenticated using (true);

create policy "Authenticated users can read leads"
  on leads for select to authenticated using (true);
create policy "Authenticated users can insert leads"
  on leads for insert to authenticated with check (true);
create policy "Authenticated users can update leads"
  on leads for update to authenticated using (true);
create policy "Authenticated users can delete leads"
  on leads for delete to authenticated using (true);
