-- HubSpot (and future CRM) integrations

create table if not exists workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'zoho', 'salesforce')),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  hub_id text,
  account_name text,
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz, 
  last_error text,
  connected_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create index if not exists workspace_integrations_workspace_id_idx
  on workspace_integrations (workspace_id);

create table if not exists lead_external_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  lead_id uuid not null references leads (id) on delete cascade,
  provider text not null check (provider in ('hubspot', 'zoho', 'salesforce')),
  external_id text not null,
  external_url text,
  last_status_pushed text,
  last_pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, external_id),
  unique (lead_id, provider)
);

create index if not exists lead_external_links_lead_id_idx
  on lead_external_links (lead_id);
create index if not exists lead_external_links_external_id_idx
  on lead_external_links (provider, external_id);

alter table workspace_integrations enable row level security;
alter table lead_external_links enable row level security;

create policy "Members can read workspace integrations"
  on workspace_integrations for select
  to authenticated
  using (is_workspace_member(workspace_id));

create policy "Owners can insert workspace integrations"
  on workspace_integrations for insert
  to authenticated
  with check (is_workspace_owner(workspace_id));

create policy "Owners can update workspace integrations"
  on workspace_integrations for update
  to authenticated
  using (is_workspace_owner(workspace_id));

create policy "Owners can delete workspace integrations"
  on workspace_integrations for delete
  to authenticated
  using (is_workspace_owner(workspace_id));

create policy "Members can read lead external links"
  on lead_external_links for select
  to authenticated
  using (is_workspace_member(workspace_id));

create policy "Members can insert lead external links"
  on lead_external_links for insert
  to authenticated
  with check (is_workspace_member(workspace_id));

create policy "Members can update lead external links"
  on lead_external_links for update
  to authenticated
  using (is_workspace_member(workspace_id));

create policy "Members can delete lead external links"
  on lead_external_links for delete
  to authenticated
  using (is_workspace_member(workspace_id));
