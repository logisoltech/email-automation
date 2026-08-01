-- Extra fields for manual lead creation
alter table leads
  add column if not exists website_url text,
  add column if not exists social_media_links text,
  add column if not exists notes text;

comment on column leads.website_url is 'Company or personal website URL';
comment on column leads.social_media_links is 'Social profile URLs (one per line or comma-separated)';
comment on column leads.notes is 'Internal notes about the lead';
