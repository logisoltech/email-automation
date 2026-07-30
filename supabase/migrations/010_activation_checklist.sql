-- Persist dismissal of the first-win activation checklist (progress is derived).
alter table workspaces
  add column if not exists activation_dismissed_at timestamptz;
