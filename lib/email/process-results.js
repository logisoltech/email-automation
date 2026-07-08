/**
 * @param {{ emails: unknown[]; campaigns: unknown[]; leads: unknown[] }} results
 */
export function formatProcessResultsMessage(results) {
  const emailCount = results.emails?.length ?? 0;
  const campaignCount = results.campaigns?.length ?? 0;
  const leadCount = results.leads?.length ?? 0;
  const leadSent = results.leads?.filter((item) => item.status === "sent").length ?? 0;
  const total = emailCount + campaignCount + leadCount;

  if (total === 0) {
    return "Nothing to process right now.";
  }

  const parts = [];

  if (emailCount) {
    parts.push(`${emailCount} scheduled email${emailCount === 1 ? "" : "s"}`);
  }

  if (campaignCount) {
    parts.push(`${campaignCount} campaign${campaignCount === 1 ? "" : "s"}`);
  }

  if (leadCount) {
    parts.push(`${leadSent} lead email${leadSent === 1 ? "" : "s"} sent`);
  }

  return `Processed ${parts.join(", ")}.`;
}
