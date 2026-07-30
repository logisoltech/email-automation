-- Existing migrated workspaces may have been marked complete without SMTP.
-- Send them through onboarding until workspace SMTP is configured.
update workspaces w
set onboarding_completed = false,
    updated_at = now()
from workspace_settings s
where s.workspace_id = w.id
  and s.smtp_configured = false;
