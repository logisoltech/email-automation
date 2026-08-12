import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import { ensureDefaultLeadCategories } from "@/lib/leads/categories";
import { getLatestImportRun } from "@/lib/leads/import-run";

/**
 * List / search workspace leads.
 * Query: q, categoryId, date, page, pageSize, importRun=latest
 */
export async function GET(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const workspaceId = session.workspace.id;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const categoryId = searchParams.get("categoryId") || "";
  const date = (searchParams.get("date") || "").trim();
  const importRunParam = (searchParams.get("importRun") || "").trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  /** @type {null | { id: string; source: string; categoryId: string | null; leadCount: number; createdAt: string }} */
  let importRunMeta = null;

  if (importRunParam === "latest") {
    try {
      const latest = await getLatestImportRun(session.supabase, workspaceId);
      if (!latest) {
        return NextResponse.json({
          leads: [],
          importRun: null,
          pagination: { page, pageSize, total: 0, totalPages: 1 },
        });
      }
      importRunMeta = {
        id: latest.id,
        source: latest.source,
        categoryId: latest.category_id,
        leadCount: latest.lead_count,
        createdAt: latest.created_at,
      };
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to load latest import." },
        { status: 500 }
      );
    }
  }

  let query = session.supabase
    .from("leads")
    .select(
      "id, name, emails, phone, country, category, category_id, project_description, budget, lead_date, status, created_at, import_run_id",
      { count: "exact" }
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (importRunMeta) {
    query = query.eq("import_run_id", importRunMeta.id);
  } else if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (date && !importRunMeta) {
    query = query.ilike("lead_date", `%${date}%`);
  }

  if (q) {
    const safe = q.replace(/[%_,.()"'\\]/g, " ").trim();
    if (safe) {
      const pattern = `%${safe}%`;
      query = query.or(
        `name.ilike.${pattern},phone.ilike.${pattern},category.ilike.${pattern},project_description.ilike.${pattern},country.ilike.${pattern},lead_date.ilike.${pattern}`
      );
    }
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let leads = data ?? [];

  if (q) {
    const needle = q.toLowerCase();
    const emailHits = leads.filter((lead) =>
      (lead.emails || []).some((email) => String(email).toLowerCase().includes(needle))
    );
    if (needle.includes("@") || emailHits.length) {
      const byId = new Map(leads.map((lead) => [lead.id, lead]));
      for (const hit of emailHits) byId.set(hit.id, hit);
      leads = [...byId.values()];
    }
  }

  const total = count ?? leads.length;

  return NextResponse.json({
    leads,
    importRun: importRunMeta,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

const createLeadSchema = z.object({
  categoryId: z.string().uuid("Pick a subcategory."),
  name: z.string().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
  phone: z.string().optional().nullable(),
  budget: z.string().optional().nullable(),
  leadDate: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  websiteUrl: z.string().optional().nullable(),
  socialMediaLinks: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Create a single lead in a subcategory (manual entry).
 */
export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  await ensureDefaultLeadCategories(session.supabase, workspaceId);

  const {
    categoryId,
    name,
    email,
    phone,
    budget,
    leadDate,
    category: serviceCategory,
    country,
    websiteUrl,
    socialMediaLinks,
    description,
    notes,
  } = parsed.data;

  const { data: category, error: categoryError } = await session.supabase
    .from("lead_categories")
    .select("id, name")
    .eq("id", categoryId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (categoryError || !category) {
    return NextResponse.json({ error: "Subcategory not found." }, { status: 404 });
  }

  const { data: lead, error } = await session.supabase
    .from("leads")
    .insert({
      workspace_id: workspaceId,
      batch_id: null,
      category_id: categoryId,
      name: name.trim(),
      emails: [email.trim().toLowerCase()],
      phone: phone?.trim() || null,
      budget: budget?.trim() || null,
      lead_date: leadDate?.trim() || null,
      category: serviceCategory?.trim() || null,
      country: country?.trim() || null,
      website_url: websiteUrl?.trim() || null,
      social_media_links: socialMediaLinks?.trim() || null,
      project_description: description?.trim() || null,
      notes: notes?.trim() || null,
      status: "pending",
    })
    .select(
      "id, name, emails, phone, country, category, budget, lead_date, category_id, website_url, social_media_links, project_description, notes, created_at"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ lead });
}
