import { getActiveProvider } from "@/lib/ai";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError, isTransientSmtpError } from "@/lib/email/nodemailer";
import { createTrackingToken } from "@/lib/email/tracking";
import {
  pushLeadOutreachStatus,
  pushStatusForRecipients,
} from "@/lib/integrations/push-status";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWorkspaceSettings } from "@/lib/workspaces";

/**
 * Cache settings per run so a batch of rows in one workspace hits the DB once.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Map<string, Record<string, unknown> | null>} cache
 * @param {string | null | undefined} workspaceId
 */
async function loadSettings(supabase, cache, workspaceId) {
  if (!workspaceId) return null;
  if (cache.has(workspaceId)) return cache.get(workspaceId) ?? null;

  const settings = await getWorkspaceSettings(supabase, workspaceId);
  cache.set(workspaceId, settings ?? null);
  return settings ?? null;
}

/**
 * Count messages already sent from this workspace in the last hour.
 * Uses emails table as the shared ledger (lead sends also insert email rows).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {string} oneHourAgo
 */
async function countWorkspaceSendsLastHour(supabase, workspaceId, oneHourAgo) {
  const { count } = await supabase
    .from("emails")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "sent")
    .gte("sent_at", oneHourAgo);

  return count ?? 0;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ id: string; workspace_id: string; sent_by: string | null; subject: string; body_text: string; body_html: string; recipients: string[]; ai_provider?: string | null; ai_prompt?: string | null; campaign_id?: string | null }} row
 * @param {Record<string, unknown> | null} [settings]
 */
export async function processScheduledEmail(supabase, row, settings) {
  try {
    const trackingToken = row.tracking_token || createTrackingToken();
    const { html } = await deliverEmail({
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      recipients: row.recipients,
      settings,
      trackingToken,
    });

    await supabase
      .from("emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        body_html: html,
        tracking_token: trackingToken,
        error_message: null,
      })
      .eq("id", row.id);

    void pushStatusForRecipients(row.workspace_id, row.recipients, "sent");

    return { id: row.id, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

    if (isTransientSmtpError(error)) {
      const retryAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      await supabase
        .from("emails")
        .update({
          status: "scheduled",
          scheduled_at: retryAt,
          error_message: `Temporary SMTP issue - will retry. ${message}`,
        })
        .eq("id", row.id);

      return { id: row.id, status: "requeued", error: message };
    }

    await supabase
      .from("emails")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", row.id);

    return { id: row.id, status: "failed", error: message };
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ id: string; workspace_id: string; created_by: string | null; name: string; subject: string; body_text: string; body_html: string; recipients: string[]; ai_provider?: string | null; ai_prompt?: string | null }} row
 * @param {Record<string, unknown> | null} [settings]
 */
export async function processScheduledCampaign(supabase, row, settings) {
  try {
    const trackingToken = createTrackingToken();
    const { html } = await deliverEmail({
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      recipients: row.recipients,
      settings,
      trackingToken,
    });

    await supabase
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        body_html: html,
        error_message: null,
      })
      .eq("id", row.id);

    await supabase.from("emails").insert({
      workspace_id: row.workspace_id,
      sent_by: row.created_by,
      campaign_id: row.id,
      subject: row.subject,
      body_html: html,
      body_text: row.body_text,
      recipients: row.recipients,
      status: "sent",
      ai_provider: row.ai_provider || getActiveProvider(),
      ai_prompt: row.ai_prompt,
      sent_at: new Date().toISOString(),
      tracking_token: trackingToken,
    });

    void pushStatusForRecipients(row.workspace_id, row.recipients, "sent");

    return { id: row.id, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

    if (isTransientSmtpError(error)) {
      const retryAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      await supabase
        .from("campaigns")
        .update({
          status: "scheduled",
          scheduled_at: retryAt,
          error_message: `Temporary SMTP issue - will retry. ${message}`,
        })
        .eq("id", row.id);

      return { id: row.id, status: "requeued", error: message };
    }

    await supabase
      .from("campaigns")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", row.id);

    return { id: row.id, status: "failed", error: message };
  }
}

/** Vercel cron runs every minute - spread hourly quota across invocations. */
const CRON_INTERVAL_MINUTES = 1;

/** How many claimed leads to send over SMTP at once (matches pool maxConnections). */
const SEND_CONCURRENCY = 2;

/**
 * @param {number} quota
 */
function getLeadsPerCronRun(quota) {
  return Math.max(1, Math.ceil(quota / (60 / CRON_INTERVAL_MINUTES)));
}

/**
 * Process all due scheduled emails, campaigns, and lead batches.
 * @param {{ drainLeads?: boolean; workspaceId?: string }} [options] - drainLeads sends all queued
 *   leads up to the hourly quota (dev/manual); workspaceId limits processing to one tenant.
 */
export async function processDueScheduledItems(options = {}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const results = { emails: [], campaigns: [], leads: [], campaignLeads: [] };
  const settingsCache = new Map();
  const { workspaceId } = options;

  let emailsQuery = supabase
    .from("emails")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (workspaceId) {
    emailsQuery = emailsQuery.eq("workspace_id", workspaceId);
  }

  const { data: emails } = await emailsQuery;

  for (const email of emails ?? []) {
    const settings = await loadSettings(supabase, settingsCache, email.workspace_id);
    const result = await processScheduledEmail(supabase, email, settings);
    results.emails.push(result);
  }

  let campaignsQuery = supabase
    .from("campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  if (workspaceId) {
    campaignsQuery = campaignsQuery.eq("workspace_id", workspaceId);
  }

  const { data: campaigns } = await campaignsQuery;

  for (const campaign of campaigns ?? []) {
    const settings = await loadSettings(supabase, settingsCache, campaign.workspace_id);
    const result = await processScheduledCampaign(supabase, campaign, settings);
    results.campaigns.push(result);
  }

  const leadResults = await processLeadBatchSends(supabase, {
    drain: options.drainLeads === true,
    workspaceId,
    settingsCache,
  });
  results.leads = leadResults;

  const campaignLeadResults = await processCampaignLeadSends(supabase, {
    drain: options.drainLeads === true,
    workspaceId,
    settingsCache,
  });
  results.campaignLeads = campaignLeadResults;

  return results;
}

/**
 * Reset leads stuck in "sending" after a crash or timeout.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 */
async function releaseStaleSendingLeads(supabase) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  await supabase
    .from("leads")
    .update({ status: "queued", sending_at: null })
    .eq("status", "sending")
    .lt("sending_at", staleBefore);

  await supabase
    .from("campaign_leads")
    .update({ status: "queued", sending_at: null })
    .eq("status", "sending")
    .lt("sending_at", staleBefore);
}

/**
 * Atomically claim one queued lead so concurrent workers cannot double-send.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} batchId
 */
async function claimQueuedLead(supabase, batchId) {
  const { data: candidates } = await supabase
    .from("leads")
    .select("id")
    .eq("batch_id", batchId)
    .eq("status", "queued")
    .order("sort_order", { ascending: true })
    .limit(10);

  for (const candidate of candidates ?? []) {
    const now = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("leads")
      .update({ status: "sending", sending_at: now })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (claimed) {
      return claimed;
    }
  }

  return null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Record<string, unknown>} lead
 * @param {Record<string, unknown>} batch
 * @param {Record<string, unknown> | null} [settings]
 */
async function sendClaimedLead(supabase, lead, batch, settings) {
  try {
    const trackingToken = createTrackingToken();
    const { html } = await deliverEmail({
      subject: lead.subject,
      bodyText: lead.body_text,
      bodyHtml: lead.body_html,
      recipients: lead.emails,
      settings,
      trackingToken,
    });

    await supabase
      .from("leads")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sending_at: null,
        body_html: html,
        error_message: null,
      })
      .eq("id", lead.id);

    await supabase.from("emails").insert({
      workspace_id: batch.workspace_id,
      sent_by: batch.created_by,
      subject: lead.subject,
      body_html: html,
      body_text: lead.body_text,
      recipients: lead.emails,
      status: "sent",
      ai_provider: getActiveProvider(),
      ai_prompt: `Lead: ${lead.name} (${batch.type})`,
      sent_at: new Date().toISOString(),
      tracking_token: trackingToken,
    });

    void pushLeadOutreachStatus(batch.workspace_id, lead.id, "sent");

    return { id: lead.id, name: lead.name, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

    if (isTransientSmtpError(error)) {
      await supabase
        .from("leads")
        .update({
          status: "queued",
          sending_at: null,
          error_message: `Temporary SMTP issue - will retry. ${message}`,
        })
        .eq("id", lead.id);

      return { id: lead.id, name: lead.name, status: "requeued", error: message };
    }

    await supabase
      .from("leads")
      .update({ status: "failed", sending_at: null, error_message: message })
      .eq("id", lead.id);

    return { id: lead.id, name: lead.name, status: "failed", error: message };
  }
}

/**
 * Send queued leads at workspace + batch sends_per_hour rate (rolling 60 min window).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{
 *   drain?: boolean;
 *   workspaceId?: string;
 *   settingsCache?: Map<string, Record<string, unknown> | null>;
 * }} [options]
 */
async function processLeadBatchSends(supabase, options = {}) {
  const results = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const settingsCache = options.settingsCache ?? new Map();
  /** @type {Map<string, number>} */
  const workspaceQuotaCache = new Map();

  await releaseStaleSendingLeads(supabase);

  let batchesQuery = supabase.from("lead_batches").select("*").eq("status", "sending");

  if (options.workspaceId) {
    batchesQuery = batchesQuery.eq("workspace_id", options.workspaceId);
  }

  const { data: batches } = await batchesQuery;

  for (const batch of batches ?? []) {
    const settings = await loadSettings(supabase, settingsCache, batch.workspace_id);
    let keepSending = true;

    if (!workspaceQuotaCache.has(batch.workspace_id)) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("sends_per_hour")
        .eq("id", batch.workspace_id)
        .maybeSingle();
      workspaceQuotaCache.set(batch.workspace_id, workspace?.sends_per_hour ?? 100);
    }

    const workspaceQuota = workspaceQuotaCache.get(batch.workspace_id) ?? 100;

    while (keepSending) {
      const [{ count: batchSentLastHour }, workspaceSentLastHour] = await Promise.all([
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("batch_id", batch.id)
          .eq("status", "sent")
          .gte("sent_at", oneHourAgo),
        countWorkspaceSendsLastHour(supabase, batch.workspace_id, oneHourAgo),
      ]);

      const batchQuota = batch.sends_per_hour ?? 100;
      const batchRemaining = batchQuota - (batchSentLastHour ?? 0);
      const workspaceRemaining = workspaceQuota - workspaceSentLastHour;
      const remaining = Math.min(batchRemaining, workspaceRemaining);

      if (remaining <= 0) {
        break;
      }

      const effectiveQuota = Math.min(batchQuota, workspaceQuota);
      const chunkSize = options.drain
        ? remaining
        : Math.min(remaining, getLeadsPerCronRun(effectiveQuota));

      let sentThisRound = 0;

      while (sentThisRound < chunkSize) {
        const claimCount = Math.min(SEND_CONCURRENCY, chunkSize - sentThisRound);
        const claimed = [];

        for (let i = 0; i < claimCount; i += 1) {
          const lead = await claimQueuedLead(supabase, batch.id);
          if (!lead) {
            break;
          }
          claimed.push(lead);
        }

        if (!claimed.length) {
          break;
        }

        const roundResults = await Promise.all(
          claimed.map((lead) => sendClaimedLead(supabase, lead, batch, settings))
        );

        results.push(...roundResults);
        sentThisRound += claimed.length;

        // If everything was requeued due to SMTP pressure, stop this batch for now
        if (roundResults.every((r) => r.status === "requeued")) {
          keepSending = false;
          break;
        }
      }

      if (sentThisRound === 0) {
        break;
      }

      keepSending = options.drain === true && keepSending;
    }

    const { count: stillQueued } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("batch_id", batch.id)
      .in("status", ["queued", "sending"]);

    if (!stillQueued) {
      await supabase
        .from("lead_batches")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", batch.id);
    } else {
      await supabase
        .from("lead_batches")
        .update({ last_send_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", batch.id);
    }
  }

  return results;
}

/**
 * Send queued campaign_leads for campaigns in "sending" status.
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{
 *   drain?: boolean;
 *   workspaceId?: string;
 *   settingsCache?: Map<string, Record<string, unknown> | null>;
 * }} [options]
 */
async function processCampaignLeadSends(supabase, options = {}) {
  const results = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const settingsCache = options.settingsCache ?? new Map();
  /** @type {Map<string, number>} */
  const workspaceQuotaCache = new Map();

  await releaseStaleSendingLeads(supabase);

  let campaignsQuery = supabase.from("campaigns").select("*").eq("status", "sending");

  if (options.workspaceId) {
    campaignsQuery = campaignsQuery.eq("workspace_id", options.workspaceId);
  }

  const { data: campaigns } = await campaignsQuery;

  for (const campaign of campaigns ?? []) {
    const settings = await loadSettings(supabase, settingsCache, campaign.workspace_id);
    let keepSending = true;

    if (!workspaceQuotaCache.has(campaign.workspace_id)) {
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("sends_per_hour")
        .eq("id", campaign.workspace_id)
        .maybeSingle();
      workspaceQuotaCache.set(campaign.workspace_id, workspace?.sends_per_hour ?? 100);
    }

    const workspaceQuota = workspaceQuotaCache.get(campaign.workspace_id) ?? 100;

    while (keepSending) {
      const workspaceSentLastHour = await countWorkspaceSendsLastHour(
        supabase,
        campaign.workspace_id,
        oneHourAgo
      );
      const remaining = workspaceQuota - workspaceSentLastHour;

      if (remaining <= 0) break;

      const chunkSize = options.drain
        ? remaining
        : Math.min(remaining, getLeadsPerCronRun(workspaceQuota));

      let sentThisRound = 0;

      while (sentThisRound < chunkSize) {
        const claimCount = Math.min(SEND_CONCURRENCY, chunkSize - sentThisRound);
        const claimed = [];

        for (let i = 0; i < claimCount; i += 1) {
          const row = await claimQueuedCampaignLead(supabase, campaign.id);
          if (!row) break;
          claimed.push(row);
        }

        if (!claimed.length) break;

        const roundResults = await Promise.all(
          claimed.map((row) => sendClaimedCampaignLead(supabase, row, campaign, settings))
        );

        results.push(...roundResults);
        sentThisRound += claimed.length;

        if (roundResults.every((r) => r.status === "requeued")) {
          keepSending = false;
          break;
        }
      }

      if (sentThisRound === 0) break;
      keepSending = options.drain === true && keepSending;
    }

    const { count: stillQueued } = await supabase
      .from("campaign_leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .in("status", ["queued", "sending"]);

    if (!stillQueued) {
      await supabase
        .from("campaigns")
        .update({ status: "completed", sent_at: new Date().toISOString() })
        .eq("id", campaign.id);
    }
  }

  return results;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} campaignId
 */
async function claimQueuedCampaignLead(supabase, campaignId) {
  const { data: candidates } = await supabase
    .from("campaign_leads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(10);

  for (const candidate of candidates ?? []) {
    const now = new Date().toISOString();
    const { data: claimed } = await supabase
      .from("campaign_leads")
      .update({ status: "sending", sending_at: now })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("*, leads(id, name, emails)")
      .maybeSingle();

    if (claimed) return claimed;
  }

  return null;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} campaign
 * @param {Record<string, unknown> | null} [settings]
 */
async function sendClaimedCampaignLead(supabase, row, campaign, settings) {
  const lead = /** @type {{ id?: string; name?: string; emails?: string[] } | null} */ (
    row.leads
  );
  const recipients = lead?.emails?.length ? lead.emails : [];

  if (!recipients.length) {
    await supabase
      .from("campaign_leads")
      .update({ status: "failed", sending_at: null, error_message: "Lead has no email." })
      .eq("id", row.id);
    return { id: row.id, status: "failed", error: "Lead has no email." };
  }

  try {
    const trackingToken = createTrackingToken();
    const { html } = await deliverEmail({
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      recipients,
      settings,
      trackingToken,
    });

    await supabase
      .from("campaign_leads")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sending_at: null,
        body_html: html,
        error_message: null,
      })
      .eq("id", row.id);

    await supabase.from("emails").insert({
      workspace_id: campaign.workspace_id,
      sent_by: campaign.created_by,
      campaign_id: campaign.id,
      subject: row.subject,
      body_html: html,
      body_text: row.body_text,
      recipients,
      status: "sent",
      ai_provider: getActiveProvider(),
      ai_prompt: `Campaign lead: ${lead?.name || row.lead_id}`,
      sent_at: new Date().toISOString(),
      tracking_token: trackingToken,
    });

    if (row.lead_id) {
      void pushLeadOutreachStatus(campaign.workspace_id, row.lead_id, "sent");
    }

    return { id: row.id, name: lead?.name, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

    if (isTransientSmtpError(error)) {
      await supabase
        .from("campaign_leads")
        .update({
          status: "queued",
          sending_at: null,
          error_message: `Temporary SMTP issue - will retry. ${message}`,
        })
        .eq("id", row.id);

      return { id: row.id, name: lead?.name, status: "requeued", error: message };
    }

    await supabase
      .from("campaign_leads")
      .update({ status: "failed", sending_at: null, error_message: message })
      .eq("id", row.id);

    return { id: row.id, name: lead?.name, status: "failed", error: message };
  }
}
