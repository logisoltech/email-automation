/**
 * Format remaining send time from count + hourly rate.
 * @param {number} remaining
 * @param {number} sendsPerHour
 */
export function formatSendEta(remaining, sendsPerHour) {
  if (remaining <= 0) return "Done";
  const rate = Math.max(1, sendsPerHour || 100);
  const minutes = Math.ceil((remaining / rate) * 60);

  if (minutes < 60) {
    return `~${minutes} min remaining`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `~${hours}h remaining`;
  }
  return `~${hours}h ${mins}m remaining`;
}

/**
 * @param {{
 *   sent?: number;
 *   queued?: number;
 *   sending?: number;
 *   failed?: number;
 *   total?: number;
 *   skipped?: number;
 * }} stats
 * @param {number} [sendsPerHour]
 */
export function getSendProgress(stats, sendsPerHour = 100) {
  const sent = stats?.sent ?? 0;
  const queued = stats?.queued ?? 0;
  const sending = stats?.sending ?? 0;
  const failed = stats?.failed ?? 0;
  const remaining = queued + sending;
  const pipeline = sent + remaining;
  const percent = pipeline > 0 ? Math.min(100, Math.round((sent / pipeline) * 100)) : 0;
  const complete = remaining === 0 && sent > 0;
  const pausedByCap = remaining > 0 && sent > 0; // still draining; hourly pacing may be idle

  return {
    sent,
    remaining,
    failed,
    pipeline,
    percent,
    complete,
    pausedByCap,
    etaLabel: formatSendEta(remaining, sendsPerHour),
    rateLabel: `Up to ${sendsPerHour}/hour`,
  };
}
