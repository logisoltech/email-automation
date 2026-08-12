-- Allow Salesforce as an import-run source (provider already allowed on integrations)

alter table lead_import_runs
  drop constraint if exists lead_import_runs_source_check;

alter table lead_import_runs
  add constraint lead_import_runs_source_check
  check (source in ('paste', 'hubspot', 'zoho', 'salesforce'));
