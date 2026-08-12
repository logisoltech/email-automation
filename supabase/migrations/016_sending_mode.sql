-- Dual sending modes: own SMTP vs platform (Resend) with domain verification

alter table workspace_settings
  add column if not exists sending_mode text
    check (sending_mode is null or sending_mode in ('own_smtp', 'platform')),
  add column if not exists sending_domain text,
  add column if not exists domain_verified_at timestamptz,
  add column if not exists resend_domain_id text;

comment on column workspace_settings.sending_mode is
  'own_smtp = workspace SMTP; platform = Resend after domain verify';
comment on column workspace_settings.sending_domain is
  'Verified (or pending) sending domain for platform mode';
comment on column workspace_settings.domain_verified_at is
  'When Resend reported the domain as verified';
comment on column workspace_settings.resend_domain_id is
  'Resend Domains API id';

-- Existing configured SMTP workspaces default to own_smtp
update workspace_settings
set sending_mode = 'own_smtp'
where smtp_configured = true
  and sending_mode is null;
