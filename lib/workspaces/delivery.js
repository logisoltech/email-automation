/**
 * Whether a workspace can send mail with the configured delivery method.
 * @param {Record<string, unknown> | null | undefined} settings
 *   Raw DB row or public settings (supports both snake_case and camelCase).
 */
export function isDeliveryReady(settings) {
  if (!settings) return false;

  const mode = settings.sending_mode ?? settings.sendingMode;
  const domainVerifiedAt = settings.domain_verified_at ?? settings.domainVerifiedAt;
  const smtpConfigured = settings.smtp_configured ?? settings.smtpConfigured;

  if (mode === "platform") {
    return Boolean(domainVerifiedAt);
  }

  return Boolean(smtpConfigured);
}

/**
 * Owner still needs onboarding if delivery is incomplete.
 * @param {{ onboarding_completed?: boolean; role?: string } | null | undefined} workspace
 * @param {Record<string, unknown> | null | undefined} settings
 */
export function ownerNeedsOnboarding(workspace, settings) {
  if (!workspace) return true;
  if (workspace.role && workspace.role !== "owner") return false;

  const completed = Boolean(workspace.onboarding_completed);
  return !completed || !isDeliveryReady(settings);
}
