create table email_templates (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  subject text not null default '',
  body_html text not null default '',
  body_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_templates_created_at_idx on email_templates (created_at desc);

alter table email_templates enable row level security;

create policy "Authenticated users can read templates"
  on email_templates for select to authenticated using (true);

create policy "Authenticated users can insert templates"
  on email_templates for insert to authenticated with check (true);

create policy "Authenticated users can update templates"
  on email_templates for update to authenticated using (true);

create policy "Authenticated users can delete templates"
  on email_templates for delete to authenticated using (true);
