import { createAdminClient } from "@/lib/supabase/admin";
import {
  OUTREACH_STATUS_LABELS as HUBSPOT_LABELS,
  ensureOutreachStatusProperty,
  getHubspotIntegration,
  getValidAccessToken as getHubspotAccessToken,
  updateContactOutreachStatus as updateHubspotStatus,
} from "@/lib/integrations/hubspot";
import {
  OUTREACH_STATUS_LABELS as ZOHO_LABELS,
  ensureOutreachStatusField,
  getZohoConfig,
  getZohoIntegration,
  getValidAccessToken as getZohoAccessToken,
  updateContactOutreachStatus as updateZohoStatus,
} from "@/lib/integrations/zoho";
import {
  OUTREACH_STATUS_LABELS as SF_LABELS,
  ensureOutreachStatusField as ensureSalesforceField,
  getSalesforceConfig,
  getSalesforceIntegration,
  getValidAccessToken as getSalesforceAccessToken,
  updateContactOutreachStatus as updateSalesforceStatus,
} from "@/lib/integrations/salesforce";

/**
 * Push outreach status to linked CRM contacts for a lead (best-effort).
 * @param {string} workspaceId
 * @param {string} leadId
 * @param {"sent" | "opened" | "failed" | "skipped"} statusKey
 */
export async function pushLeadOutreachStatus(workspaceId, leadId, statusKey) {
  if (!workspaceId || !leadId || !statusKey) return;

  try {
    const supabase = createAdminClient();
    const { data: links } = await supabase
      .from("lead_external_links")
      .select("id, external_id, provider")
      .eq("workspace_id", workspaceId)
      .eq("lead_id", leadId);

    if (!links?.length) return;

    const hubspotLinks = links.filter((l) => l.provider === "hubspot");
    const zohoLinks = links.filter((l) => l.provider === "zoho");
    const salesforceLinks = links.filter((l) => l.provider === "salesforce");

    if (hubspotLinks.length) {
      await pushHubspot(supabase, workspaceId, hubspotLinks, statusKey);
    }
    if (zohoLinks.length) {
      await pushZoho(supabase, workspaceId, zohoLinks, statusKey);
    }
    if (salesforceLinks.length) {
      await pushSalesforce(supabase, workspaceId, salesforceLinks, statusKey);
    }
  } catch (err) {
    console.error("[crm] pushLeadOutreachStatus", err);
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {Array<{ id: string; external_id: string }>} links
 * @param {string} statusKey
 */
async function pushHubspot(supabase, workspaceId, links, statusKey) {
  const integration = await getHubspotIntegration(supabase, workspaceId);
  if (!integration || integration.status !== "connected") return;

  const accessToken = await getHubspotAccessToken(supabase, integration);
  try {
    await ensureOutreachStatusProperty(accessToken);
  } catch (propErr) {
    console.error("[hubspot] ensureOutreachStatusProperty", propErr);
  }
  const label = HUBSPOT_LABELS[statusKey] || statusKey;

  for (const link of links) {
    try {
      await updateHubspotStatus(accessToken, link.external_id, label);
      await supabase
        .from("lead_external_links")
        .update({
          last_status_pushed: label,
          last_pushed_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    } catch (err) {
      console.error("[hubspot] status push failed", link.external_id, err);
    }
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {Array<{ id: string; external_id: string }>} links
 * @param {string} statusKey
 */
async function pushZoho(supabase, workspaceId, links, statusKey) {
  const integration = await getZohoIntegration(supabase, workspaceId);
  if (!integration || integration.status !== "connected") return;

  const accessToken = await getZohoAccessToken(supabase, integration);
  const { apiDomain, statusField } = getZohoConfig(integration);
  try {
    await ensureOutreachStatusField(accessToken, apiDomain, statusField);
  } catch (propErr) {
    console.error("[zoho] ensureOutreachStatusField", propErr);
  }
  const label = ZOHO_LABELS[statusKey] || statusKey;

  for (const link of links) {
    try {
      await updateZohoStatus(accessToken, apiDomain, link.external_id, label, statusField);
      await supabase
        .from("lead_external_links")
        .update({
          last_status_pushed: label,
          last_pushed_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    } catch (err) {
      console.error("[zoho] status push failed", link.external_id, err);
    }
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {string} workspaceId
 * @param {Array<{ id: string; external_id: string }>} links
 * @param {string} statusKey
 */
async function pushSalesforce(supabase, workspaceId, links, statusKey) {
  const integration = await getSalesforceIntegration(supabase, workspaceId);
  if (!integration || integration.status !== "connected") return;

  const accessToken = await getSalesforceAccessToken(supabase, integration);
  const { instanceUrl, statusField } = getSalesforceConfig(integration);
  if (!instanceUrl) return;

  try {
    await ensureSalesforceField(accessToken, instanceUrl, statusField);
  } catch (propErr) {
    console.error("[salesforce] ensureOutreachStatusField", propErr);
  }
  const label = SF_LABELS[statusKey] || statusKey;

  for (const link of links) {
    try {
      await updateSalesforceStatus(
        accessToken,
        instanceUrl,
        link.external_id,
        label,
        statusField
      );
      await supabase
        .from("lead_external_links")
        .update({
          last_status_pushed: label,
          last_pushed_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    } catch (err) {
      console.error("[salesforce] status push failed", link.external_id, err);
    }
  }
}

/**
 * Resolve lead id from an emails history row recipients / campaign lead.
 * For compose sends we may only have email addresses — match by email in workspace.
 * @param {string} workspaceId
 * @param {string[]} recipients
 * @param {"sent" | "opened" | "failed" | "skipped"} statusKey
 */
export async function pushStatusForRecipients(workspaceId, recipients, statusKey) {
  if (!workspaceId || !recipients?.length) return;

  try {
    const supabase = createAdminClient();
    const emails = recipients.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
    if (!emails.length) return;

    const { data: leads } = await supabase
      .from("leads")
      .select("id, emails")
      .eq("workspace_id", workspaceId)
      .overlaps("emails", emails);

    for (const lead of leads || []) {
      await pushLeadOutreachStatus(workspaceId, lead.id, statusKey);
    }
  } catch (err) {
    console.error("[crm] pushStatusForRecipients", err);
  }
}
