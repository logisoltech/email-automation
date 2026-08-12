-- Workspace-level image signature (default when templates don't override)

alter table workspace_settings
  add column if not exists signature_image_url text;

comment on column workspace_settings.signature_image_url is
  'Public URL for default image email signature; templates may override';
