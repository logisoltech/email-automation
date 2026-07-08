import { getActiveProvider } from "@/lib/ai";
import { deliverEmail } from "@/lib/email/send";
import { formatSmtpError } from "@/lib/email/nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ id: string; sent_by: string | null; subject: string; body_text: string; body_html: string; recipients: string[]; ai_provider?: string | null; ai_prompt?: string | null; campaign_id?: string | null }} row
 */
export async function processScheduledEmail(supabase, row) {
  try {
    const { html } = await deliverEmail({
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      recipients: row.recipients,
    });

    await supabase
      .from("emails")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        body_html: html,
        error_message: null,
      })
      .eq("id", row.id);

    return { id: row.id, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

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
 * @param {{ id: string; created_by: string | null; name: string; subject: string; body_text: string; body_html: string; recipients: string[]; ai_provider?: string | null; ai_prompt?: string | null }} row
 */
export async function processScheduledCampaign(supabase, row) {
  try {
    const { html } = await deliverEmail({
      subject: row.subject,
      bodyText: row.body_text,
      bodyHtml: row.body_html,
      recipients: row.recipients,
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
    });

    return { id: row.id, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

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

/** Vercel cron runs every minute — spread hourly quota across invocations. */
const CRON_INTERVAL_MINUTES = 1;

/**
 * @param {number} quota
 */
function getLeadsPerCronRun(quota) {
  return Math.max(1, Math.ceil(quota / (60 / CRON_INTERVAL_MINUTES)));
}

/**
 * Process all due scheduled emails, campaigns, and lead batches.
 * @param {{ drainLeads?: boolean }} [options] — drainLeads sends all queued leads up to the hourly quota (dev/manual).
 */
export async function processDueScheduledItems(options = {}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const results = { emails: [], campaigns: [], leads: [] };

  const { data: emails } = await supabase
    .from("emails")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  for (const email of emails ?? []) {
    const result = await processScheduledEmail(supabase, email);
    results.emails.push(result);
  }

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", now);

  for (const campaign of campaigns ?? []) {
    const result = await processScheduledCampaign(supabase, campaign);
    results.campaigns.push(result);
  }

  const leadResults = await processLeadBatchSends(supabase, {
    drain: options.drainLeads === true,
  });
  results.leads = leadResults;

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
 */
async function sendClaimedLead(supabase, lead, batch) {
  try {
    const { html } = await deliverEmail({
      subject: lead.subject,
      bodyText: lead.body_text,
      bodyHtml: lead.body_html,
      recipients: lead.emails,
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
      sent_by: batch.created_by,
      subject: lead.subject,
      body_html: html,
      body_text: lead.body_text,
      recipients: lead.emails,
      status: "sent",
      ai_provider: getActiveProvider(),
      ai_prompt: `Lead: ${lead.name} (${batch.type})`,
      sent_at: new Date().toISOString(),
    });

    return { id: lead.id, name: lead.name, status: "sent" };
  } catch (error) {
    const message = formatSmtpError(error);

    await supabase
      .from("leads")
      .update({ status: "failed", sending_at: null, error_message: message })
      .eq("id", lead.id);

    return { id: lead.id, name: lead.name, status: "failed", error: message };
  }
}

/**
 * Send queued leads at sends_per_hour rate (rolling 60 min window).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ drain?: boolean }} [options]
 */
async function processLeadBatchSends(supabase, options = {}) {
  const results = [];
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  await releaseStaleSendingLeads(supabase);

  const { data: batches } = await supabase
    .from("lead_batches")
    .select("*")
    .eq("status", "sending");

  for (const batch of batches ?? []) {
    let keepSending = true;

    while (keepSending) {
      const { count: sentLastHour } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("batch_id", batch.id)
        .eq("status", "sent")
        .gte("sent_at", oneHourAgo);

      const quota = batch.sends_per_hour ?? 100;
      const remaining = quota - (sentLastHour ?? 0);

      if (remaining <= 0) {
        break;
      }

      const chunkSize = options.drain
        ? remaining
        : Math.min(remaining, getLeadsPerCronRun(quota));

      let sentThisRound = 0;

      while (sentThisRound < chunkSize) {
        const lead = await claimQueuedLead(supabase, batch.id);
        if (!lead) {
          break;
        }

        const result = await sendClaimedLead(supabase, lead, batch);
        results.push(result);
        sentThisRound += 1;
      }

      if (sentThisRound === 0) {
        break;
      }

      keepSending = options.drain === true;
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
