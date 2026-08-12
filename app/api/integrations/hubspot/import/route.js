import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { ensureDefaultLeadCategories } from "@/lib/leads/categories";
import { createImportRun, finalizeImportRun } from "@/lib/leads/import-run";
import {
  getHubspotIntegration,
  getValidAccessToken,
  listContacts,
  mapHubspotContactToLead,
} from "@/lib/integrations/hubspot";

const importSchema = z.object({
  categoryId: z.string().uuid("Pick a subcategory."),
  contactIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

/**
 * Preview HubSpot contacts (first page).
 */
export async function GET(request) {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const integration = await getHubspotIntegration(session.supabase, session.workspace.id);
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Connect HubSpot first." }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(session.supabase, integration);
    const after = new URL(request.url).searchParams.get("after") || undefined;
    const data = await listContacts(accessToken, { after, limit: 50 });
    const contacts = (data.results || []).map((c) => {
      const mapped = mapHubspotContactToLead(c);
      return {
        id: mapped.externalId,
        name: mapped.name,
        email: mapped.email,
        phone: mapped.phone,
        company: c.properties?.company || null,
      };
    });

    return NextResponse.json({
      contacts,
      paging: data.paging || null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list contacts." },
      { status: 502 }
    );
  }
}

/**
 * Import selected (or first N) HubSpot contacts as leads.
 */
export async function POST(request) {
  const { session, error } = await requireWorkspaceSession();
  if (error) return error;

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  await ensureDefaultLeadCategories(session.supabase, workspaceId);

  const { data: category } = await session.supabase
    .from("lead_categories")
    .select("id")
    .eq("id", parsed.data.categoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }

  const integration = await getHubspotIntegration(session.supabase, workspaceId);
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Connect HubSpot first." }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken(session.supabase, integration);
    const wanted = parsed.data.contactIds?.length
      ? new Set(parsed.data.contactIds)
      : null;
    const max = parsed.data.limit || 50;

    /** @type {Array<ReturnType<typeof mapHubspotContactToLead>>} */
    const toImport = [];
    let after;
    while (toImport.length < max) {
      const page = await listContacts(accessToken, { after, limit: 50 });
      for (const contact of page.results || []) {
        const mapped = mapHubspotContactToLead(contact);
        if (!mapped.email) continue;
        if (wanted && !wanted.has(mapped.externalId)) continue;
        toImport.push(mapped);
        if (toImport.length >= max) break;
      }
      after = page.paging?.next?.after;
      if (!after || (wanted && toImport.length >= wanted.size)) break;
      if (!wanted && toImport.length >= max) break;
    }

    let imported = 0;
    let skipped = 0;
    let linked = 0;

    let importRunId = null;
    if (toImport.length > 0) {
      importRunId = await createImportRun(session.supabase, {
        workspaceId,
        userId: session.user.id,
        source: "hubspot",
        categoryId: parsed.data.categoryId,
        leadCount: 0,
      });
    }

    for (const item of toImport) {
      const { data: existingLink } = await session.supabase
        .from("lead_external_links")
        .select("lead_id")
        .eq("workspace_id", workspaceId)
        .eq("provider", "hubspot")
        .eq("external_id", item.externalId)
        .maybeSingle();

      if (existingLink?.lead_id) {
        skipped += 1;
        continue;
      }

      const { data: lead, error: leadError } = await session.supabase
        .from("leads")
        .insert({
          workspace_id: workspaceId,
          batch_id: null,
          import_run_id: importRunId,
          category_id: parsed.data.categoryId,
          name: item.name,
          emails: [item.email],
          phone: item.phone,
          country: item.country,
          category: item.category,
          website_url: item.websiteUrl,
          notes: item.notes,
          status: "pending",
        })
        .select("id")
        .single();

      if (leadError || !lead) {
        skipped += 1;
        continue;
      }

      const { error: linkError } = await session.supabase.from("lead_external_links").insert({
        workspace_id: workspaceId,
        lead_id: lead.id,
        provider: "hubspot",
        external_id: item.externalId,
        external_url: `https://app.hubspot.com/contacts/${integration.hub_id || ""}/record/0-1/${item.externalId}`,
      });

      if (linkError) {
        skipped += 1;
        continue;
      }

      imported += 1;
      linked += 1;
    }

    if (importRunId) {
      if (imported === 0) {
        await session.supabase.from("lead_import_runs").delete().eq("id", importRunId);
      } else {
        await finalizeImportRun(session.supabase, importRunId, imported);
      }
    }

    await session.supabase
      .from("workspace_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);

    return NextResponse.json({
      imported,
      skipped,
      linked,
      total: toImport.length,
      importRunId: imported > 0 ? importRunId : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed." },
      { status: 502 }
    );
  }
}
