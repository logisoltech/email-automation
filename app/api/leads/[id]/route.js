import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { signatureFromSettings, withEmailSignature } from "@/lib/email/signature";
import { getWorkspaceSettings } from "@/lib/workspaces";

const LEAD_DETAIL_SELECT =
  "id, name, emails, phone, country, category, category_id, project_description, budget, lead_date, website_url, social_media_links, notes, status, created_at";

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(_request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { data: lead, error } = await session.supabase
    .from("leads")
    .select(LEAD_DETAIL_SELECT)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  let categoryName = null;
  if (lead.category_id) {
    const { data: category } = await session.supabase
      .from("lead_categories")
      .select("id, name")
      .eq("id", lead.category_id)
      .maybeSingle();
    categoryName = category?.name || null;
  }

  return NextResponse.json({
    lead: {
      ...lead,
      subcategory_name: categoryName,
    },
  });
}

const updateSchema = z.object({
  // Profile / manual lead fields
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  leadDate: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  socialMediaLinks: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Campaign email draft fields (legacy)
  subject: z.string().optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  status: z.enum(["generated", "skipped"]).optional(),
});

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function PUT(request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;

  const { data: existing, error: existingError } = await session.supabase
    .from("leads")
    .select("id, workspace_id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const data = parsed.data;
  const updates = {};

  if (data.categoryId !== undefined) {
    const { data: category, error: categoryError } = await session.supabase
      .from("lead_categories")
      .select("id")
      .eq("id", data.categoryId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (categoryError || !category) {
      return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
    }
    updates.category_id = data.categoryId;
  }

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.email !== undefined) updates.emails = [data.email.trim().toLowerCase()];
  if (data.phone !== undefined) updates.phone = data.phone?.trim() || null;
  if (data.budget !== undefined) updates.budget = data.budget?.trim() || null;
  if (data.leadDate !== undefined) updates.lead_date = data.leadDate?.trim() || null;
  if (data.category !== undefined) updates.category = data.category?.trim() || null;
  if (data.country !== undefined) updates.country = data.country?.trim() || null;
  if (data.websiteUrl !== undefined) updates.website_url = data.websiteUrl?.trim() || null;
  if (data.socialMediaLinks !== undefined) {
    updates.social_media_links = data.socialMediaLinks?.trim() || null;
  }
  if (data.description !== undefined) {
    updates.project_description = data.description?.trim() || null;
  }
  if (data.notes !== undefined) updates.notes = data.notes?.trim() || null;

  if (data.subject !== undefined) updates.subject = data.subject;
  if (data.bodyText !== undefined) {
    const settings = await getWorkspaceSettings(session.supabase, workspaceId);
    const signed = withEmailSignature(
      {
        bodyText: data.bodyText,
        bodyHtml: data.bodyHtml,
      },
      signatureFromSettings(settings)
    );
    updates.body_text = signed.bodyText;
    updates.body_html = signed.bodyHtml;
  }
  if (data.status !== undefined) updates.status = data.status;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const { data: lead, error } = await session.supabase
    .from("leads")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select(LEAD_DETAIL_SELECT)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead });
}

/**
 * @param {import("next/server").NextRequest} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function DELETE(_request, { params }) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { id } = await params;
  const workspaceId = session.workspace.id;

  const { data: existing, error: existingError } = await session.supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  const { error } = await session.supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
