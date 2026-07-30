-- Multi-tenant SaaS: workspaces, membership, settings, and tenant-scoped RLS

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Workspaces
-- ---------------------------------------------------------------------------

create type workspace_role as enum ('owner', 'member');
create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  plan text not null default 'free',
  sends_per_hour int not null default 100,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  email text not null,
  role workspace_role not null default 'member',
  token text not null unique,
  status invitation_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table workspace_settings (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  from_name text not null default '',
  from_email text not null default '',
  signature_text text not null default '',
  signature_html text not null default '',
  smtp_host text,
  smtp_port int not null default 587,
  smtp_secure boolean not null default false,
  smtp_user text,
  smtp_pass_encrypted text,
  smtp_tls_reject_unauthorized boolean not null default true,
  smtp_configured boolean not null default false,
  smtp_last_tested_at timestamptz,
  smtp_last_error text,
  updated_at timestamptz not null default now()
);

create index workspace_members_user_id_idx on workspace_members (user_id);
create index workspace_members_workspace_id_idx on workspace_members (workspace_id);
create index workspace_invitations_email_idx on workspace_invitations (email);
create index workspace_invitations_token_idx on workspace_invitations (token);

-- ---------------------------------------------------------------------------
-- Helper: membership check for RLS
-- ---------------------------------------------------------------------------

create or replace function is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
  );
$$;

create or replace function is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Backfill existing data into a default Logisol workspace
-- ---------------------------------------------------------------------------

do $$
declare
  default_workspace_id uuid;
  first_user_id uuid;
begin
  select id into first_user_id from auth.users order by created_at asc limit 1;

  insert into workspaces (name, slug, created_by, onboarding_completed)
  values ('Logisol', 'logisol', first_user_id, false)
  returning id into default_workspace_id;

  insert into workspace_settings (
    workspace_id,
    from_name,
    from_email,
    signature_text,
    signature_html
  ) values (
    default_workspace_id,
    coalesce(current_setting('app.settings.smtp_from_name', true), 'Logisol'),
    coalesce(current_setting('app.settings.smtp_from_email', true), ''),
    E'Best Regards,\nRyan Davis\nBusiness Development Manager\n(415) 969-4133\nLogisol Technologies',
    '<p style="margin: 16px 0 0 0; line-height: 1.6;">Best Regards,<br>Ryan Davis<br>Business Development Manager<br>(415) 969-4133<br>Logisol Technologies</p>'
  );

  if first_user_id is not null then
    insert into workspace_members (workspace_id, user_id, role)
    values (default_workspace_id, first_user_id, 'owner')
    on conflict do nothing;

    insert into workspace_members (workspace_id, user_id, role)
    select default_workspace_id, id, 'member'
    from auth.users
    where id <> first_user_id
    on conflict do nothing;
  end if;

  -- Attach workspace_id to existing tables
  alter table emails add column if not exists workspace_id uuid references workspaces (id) on delete cascade;
  alter table campaigns add column if not exists workspace_id uuid references workspaces (id) on delete cascade;
  alter table email_templates add column if not exists workspace_id uuid references workspaces (id) on delete cascade;
  alter table lead_batches add column if not exists workspace_id uuid references workspaces (id) on delete cascade;
  alter table ai_instructions add column if not exists workspace_id uuid references workspaces (id) on delete cascade;

  update emails set workspace_id = default_workspace_id where workspace_id is null;
  update campaigns set workspace_id = default_workspace_id where workspace_id is null;
  update email_templates set workspace_id = default_workspace_id where workspace_id is null;
  update lead_batches set workspace_id = default_workspace_id where workspace_id is null;
  update ai_instructions set workspace_id = default_workspace_id where workspace_id is null;
end $$;

alter table emails alter column workspace_id set not null;
alter table campaigns alter column workspace_id set not null;
alter table email_templates alter column workspace_id set not null;
alter table lead_batches alter column workspace_id set not null;
alter table ai_instructions alter column workspace_id set not null;

create index if not exists emails_workspace_id_idx on emails (workspace_id, created_at desc);
create index if not exists campaigns_workspace_id_idx on campaigns (workspace_id, created_at desc);
create index if not exists email_templates_workspace_id_idx on email_templates (workspace_id, updated_at desc);
create index if not exists lead_batches_workspace_id_idx on lead_batches (workspace_id, created_at desc);
create index if not exists ai_instructions_workspace_id_idx on ai_instructions (workspace_id, created_at asc);

-- ---------------------------------------------------------------------------
-- Replace permissive RLS with workspace membership policies
-- ---------------------------------------------------------------------------

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invitations enable row level security;
alter table workspace_settings enable row level security;

-- Workspaces
create policy "Members can read their workspaces"
  on workspaces for select to authenticated
  using (is_workspace_member(id));

create policy "Authenticated users can create workspaces"
  on workspaces for insert to authenticated
  with check (created_by = auth.uid());

create policy "Owners can update workspaces"
  on workspaces for update to authenticated
  using (is_workspace_owner(id));

create policy "Owners can delete workspaces"
  on workspaces for delete to authenticated
  using (is_workspace_owner(id));

-- Members
create policy "Members can read workspace members"
  on workspace_members for select to authenticated
  using (is_workspace_member(workspace_id) or user_id = auth.uid());

create policy "Owners can insert members"
  on workspace_members for insert to authenticated
  with check (is_workspace_owner(workspace_id) or user_id = auth.uid());

create policy "Owners can update members"
  on workspace_members for update to authenticated
  using (is_workspace_owner(workspace_id));

create policy "Owners can delete members"
  on workspace_members for delete to authenticated
  using (is_workspace_owner(workspace_id) or user_id = auth.uid());

-- Invitations
create policy "Members can read invitations"
  on workspace_invitations for select to authenticated
  using (is_workspace_member(workspace_id));

create policy "Owners can manage invitations"
  on workspace_invitations for insert to authenticated
  with check (is_workspace_owner(workspace_id));

create policy "Owners can update invitations"
  on workspace_invitations for update to authenticated
  using (is_workspace_owner(workspace_id));

create policy "Owners can delete invitations"
  on workspace_invitations for delete to authenticated
  using (is_workspace_owner(workspace_id));

-- Settings
create policy "Members can read workspace settings"
  on workspace_settings for select to authenticated
  using (is_workspace_member(workspace_id));

create policy "Owners can insert workspace settings"
  on workspace_settings for insert to authenticated
  with check (is_workspace_owner(workspace_id));

create policy "Owners can update workspace settings"
  on workspace_settings for update to authenticated
  using (is_workspace_owner(workspace_id));

-- Drop old open policies and recreate scoped ones
drop policy if exists "Authenticated users can read emails" on emails;
drop policy if exists "Authenticated users can insert emails" on emails;
drop policy if exists "Authenticated users can update emails" on emails;
drop policy if exists "Authenticated users can delete emails" on emails;

create policy "Members can read workspace emails"
  on emails for select to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can insert workspace emails"
  on emails for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "Members can update workspace emails"
  on emails for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can delete workspace emails"
  on emails for delete to authenticated
  using (is_workspace_member(workspace_id));

drop policy if exists "Authenticated users can read campaigns" on campaigns;
drop policy if exists "Authenticated users can insert campaigns" on campaigns;
drop policy if exists "Authenticated users can update campaigns" on campaigns;
drop policy if exists "Authenticated users can delete campaigns" on campaigns;

create policy "Members can read workspace campaigns"
  on campaigns for select to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can insert workspace campaigns"
  on campaigns for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "Members can update workspace campaigns"
  on campaigns for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can delete workspace campaigns"
  on campaigns for delete to authenticated
  using (is_workspace_member(workspace_id));

drop policy if exists "Authenticated users can read templates" on email_templates;
drop policy if exists "Authenticated users can insert templates" on email_templates;
drop policy if exists "Authenticated users can update templates" on email_templates;
drop policy if exists "Authenticated users can delete templates" on email_templates;

create policy "Members can read workspace templates"
  on email_templates for select to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can insert workspace templates"
  on email_templates for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "Members can update workspace templates"
  on email_templates for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can delete workspace templates"
  on email_templates for delete to authenticated
  using (is_workspace_member(workspace_id));

drop policy if exists "Authenticated users can read lead_batches" on lead_batches;
drop policy if exists "Authenticated users can insert lead_batches" on lead_batches;
drop policy if exists "Authenticated users can update lead_batches" on lead_batches;
drop policy if exists "Authenticated users can delete lead_batches" on lead_batches;

create policy "Members can read workspace lead_batches"
  on lead_batches for select to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can insert workspace lead_batches"
  on lead_batches for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "Members can update workspace lead_batches"
  on lead_batches for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can delete workspace lead_batches"
  on lead_batches for delete to authenticated
  using (is_workspace_member(workspace_id));

-- Leads inherit access via batch membership
drop policy if exists "Authenticated users can read leads" on leads;
drop policy if exists "Authenticated users can insert leads" on leads;
drop policy if exists "Authenticated users can update leads" on leads;
drop policy if exists "Authenticated users can delete leads" on leads;

create policy "Members can read workspace leads"
  on leads for select to authenticated
  using (
    exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );
create policy "Members can insert workspace leads"
  on leads for insert to authenticated
  with check (
    exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );
create policy "Members can update workspace leads"
  on leads for update to authenticated
  using (
    exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );
create policy "Members can delete workspace leads"
  on leads for delete to authenticated
  using (
    exists (
      select 1 from lead_batches b
      where b.id = leads.batch_id and is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "Authenticated users can read ai instructions" on ai_instructions;
drop policy if exists "Authenticated users can insert ai instructions" on ai_instructions;
drop policy if exists "Authenticated users can update ai instructions" on ai_instructions;
drop policy if exists "Authenticated users can delete ai instructions" on ai_instructions;

create policy "Members can read workspace ai instructions"
  on ai_instructions for select to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can insert workspace ai instructions"
  on ai_instructions for insert to authenticated
  with check (is_workspace_member(workspace_id));
create policy "Members can update workspace ai instructions"
  on ai_instructions for update to authenticated
  using (is_workspace_member(workspace_id));
create policy "Members can delete workspace ai instructions"
  on ai_instructions for delete to authenticated
  using (is_workspace_member(workspace_id));
