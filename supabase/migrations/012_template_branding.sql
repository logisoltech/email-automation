-- Per-template branding + starter flag
alter table email_templates
  add column if not exists logo_url text,
  add column if not exists signature_image_url text,
  add column if not exists is_starter boolean not null default false;

comment on column email_templates.logo_url is 'Public URL for company logo shown at top of email';
comment on column email_templates.signature_image_url is 'Public URL for image email signature';
comment on column email_templates.is_starter is 'Seeded starter template badge; still fully editable';

-- Public bucket for template logos / signature images (email clients need absolute URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'email-assets',
  'email-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can read public assets (required for email <img src>)
drop policy if exists "Public read email-assets" on storage.objects;
create policy "Public read email-assets"
  on storage.objects for select
  to public
  using (bucket_id = 'email-assets');

-- Workspace members can upload under {workspace_id}/…
drop policy if exists "Members upload email-assets" on storage.objects;
create policy "Members upload email-assets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'email-assets'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Members update email-assets" on storage.objects;
create policy "Members update email-assets"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'email-assets'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'email-assets'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "Members delete email-assets" on storage.objects;
create policy "Members delete email-assets"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'email-assets'
    and is_workspace_member((storage.foldername(name))[1]::uuid)
  );
