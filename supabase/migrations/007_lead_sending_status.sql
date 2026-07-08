-- Prevent duplicate sends: claim a lead before SMTP delivery
alter type lead_row_status add value if not exists 'sending';

alter table leads add column if not exists sending_at timestamptz;
