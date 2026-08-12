-- Switch platform delivery from Resend to Amazon SES

alter table workspace_settings
  add column if not exists ses_identity text;

comment on column workspace_settings.ses_identity is
  'Amazon SES email identity (usually the sending domain)';

comment on column workspace_settings.sending_mode is
  'own_smtp = workspace SMTP; platform = Amazon SES after domain verify';

comment on column workspace_settings.domain_verified_at is
  'When Amazon SES reported the domain as verified for sending';

-- Prefer sending_domain as the SES identity for platform workspaces
update workspace_settings
set ses_identity = coalesce(ses_identity, sending_domain)
where sending_mode = 'platform'
  and sending_domain is not null
  and (ses_identity is null or ses_identity = '');

-- Clear obsolete Resend ids (column kept for backwards compatibility)
update workspace_settings
set resend_domain_id = null
where resend_domain_id is not null;
