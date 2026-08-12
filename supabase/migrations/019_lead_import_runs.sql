-- Track each multi-lead import (paste / HubSpot / Zoho) for "latest import" campaign picks

create table if not exists lead_import_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  source text not null check (source in ('paste', 'hubspot', 'zoho')),
  category_id uuid references lead_categories (id) on delete set null,
  lead_count int not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists lead_import_runs_workspace_created_idx
  on lead_import_runs (workspace_id, created_at desc);

alter table leads
  add column if not exists import_run_id uuid references lead_import_runs (id) on delete set null;

create index if not exists leads_workspace_import_run_idx
  on leads (workspace_id, import_run_id)
  where import_run_id is not null;

alter table lead_import_runs enable row level security;

create policy "Members can read lead import runs"
  on lead_import_runs for select
  to authenticated
  using (is_workspace_member(workspace_id));

create policy "Members can insert lead import runs"
  on lead_import_runs for insert
  to authenticated
  with check (is_workspace_member(workspace_id));

create policy "Members can update lead import runs"
  on lead_import_runs for update
  to authenticated
  using (is_workspace_member(workspace_id));

create policy "Members can delete lead import runs"
  on lead_import_runs for delete
  to authenticated
  using (is_workspace_member(workspace_id));
