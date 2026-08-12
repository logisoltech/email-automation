-- Open tracking for sent emails (1x1 pixel → /api/t/o/:token)

alter table emails
  add column if not exists tracking_token uuid,
  add column if not exists opened_at timestamptz,
  add column if not exists open_count integer not null default 0;

update emails
set tracking_token = gen_random_uuid()
where tracking_token is null;

alter table emails
  alter column tracking_token set default gen_random_uuid(),
  alter column tracking_token set not null;

create unique index if not exists emails_tracking_token_idx on emails (tracking_token);
create index if not exists emails_opened_at_idx on emails (opened_at)
  where opened_at is not null;
