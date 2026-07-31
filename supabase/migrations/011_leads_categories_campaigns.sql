-- Lead subcategories + campaign_leads (per-recipient personalized emails)

create table lead_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, name),
  unique (workspace_id, slug)
);

create index lead_categories_workspace_idx on lead_categories (workspace_id);

alter table leads
  add column if not exists workspace_id uuid references workspaces (id) on delete cascade,
  add column if not exists category_id uuid references lead_categories (id) on delete set null;

alter table leads alter column batch_id drop not null;

-- Backfill workspace_id from parent batch
update leads l
set workspace_id = b.workspace_id
from lead_batches b
where l.batch_id = b.id
  and l.workspace_id is null;

create index if not exists leads_workspace_id_idx on leads (workspace_id);
create index if not exists leads_category_id_idx on leads (category_id);
create index if not exists leads_workspace_lead_date_idx on leads (workspace_id, lead_date);

-- Seed Website + SMM categories per workspace and map existing batch types
insert into lead_categories (workspace_id, name, slug)
select w.id, 'Website', 'website'
from workspaces w
where not exists (
  select 1 from lead_categories c where c.workspace_id = w.id and c.slug = 'website'
);

insert into lead_categories (workspace_id, name, slug)
select w.id, 'SMM', 'smm'
from workspaces w
where not exists (
  select 1 from lead_categories c where c.workspace_id = w.id and c.slug = 'smm'
);

update leads l
set category_id = c.id
from lead_batches b
join lead_categories c
  on c.workspace_id = b.workspace_id
 and c.slug = b.type::text
where l.batch_id = b.id
  and l.category_id is null;

-- Campaign statuses for the new generate → review → send lifecycle
alter type campaign_status add value if not exists 'generating';
alter type campaign_status add value if not exists 'review';
alter type campaign_status add value if not exists 'sending';
alter type campaign_status add value if not exists 'completed';

alter table campaigns
  add column if not exists category_id uuid references lead_categories (id) on delete set null,
  add column if not exists lead_type text;

create type campaign_lead_status as enum (
  'pending',
  'generated',
  'queued',
  'sending',
  'sent',
  'failed',
  'skipped'
);

create table campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  lead_id uuid not null references leads (id) on delete cascade,
  subject text,
  body_text text,
  body_html text,
  status campaign_lead_status not null default 'pending',
  error_message text,
  sending_at timestamptz,
  sent_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index campaign_leads_campaign_status_idx on campaign_leads (campaign_id, status);
create index campaign_leads_lead_id_idx on campaign_leads (lead_id);

alter table lead_categories enable row level security;
alter table campaign_leads enable row level security;

create policy "Members can read workspace lead_categories"
  on lead_categories for select to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can insert workspace lead_categories"
  on lead_categories for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "Members can update workspace lead_categories"
  on lead_categories for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can delete workspace lead_categories"
  on lead_categories for delete to authenticated
  using (is_workspace_member(workspace_id));

-- Leads: allow access via workspace_id (preferred) or batch membership
drop policy if exists "Members can read workspace leads" on leads;
drop policy if exists "Members can insert workspace leads" on leads;
drop policy if exists "Members can update workspace leads" on leads;
drop policy if exists "Members can delete workspace leads" on leads;

create policy "Members can read workspace leads"
  on leads for select to authenticated
  using (
    (workspace_id is not null and is_workspace_member(workspace_id))
    or exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );

create policy "Members can insert workspace leads"
  on leads for insert to authenticated
  with check (
    (workspace_id is not null and is_workspace_member(workspace_id))
    or exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );

create policy "Members can update workspace leads"
  on leads for update to authenticated
  using (
    (workspace_id is not null and is_workspace_member(workspace_id))
    or exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );

create policy "Members can delete workspace leads"
  on leads for delete to authenticated
  using (
    (workspace_id is not null and is_workspace_member(workspace_id))
    or exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );

create policy "Members can read workspace campaign_leads"
  on campaign_leads for select to authenticated
  using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_leads.campaign_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "Members can insert workspace campaign_leads"
  on campaign_leads for insert to authenticated
  with check (
    exists (
      select 1 from campaigns c
      where c.id = campaign_leads.campaign_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "Members can update workspace campaign_leads"
  on campaign_leads for update to authenticated
  using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_leads.campaign_id and is_workspace_member(c.workspace_id)
    )
  );

create policy "Members can delete workspace campaign_leads"
  on campaign_leads for delete to authenticated
  using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_leads.campaign_id and is_workspace_member(c.workspace_id)
    )
  );
