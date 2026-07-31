import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

/**
 * List / search workspace leads.
 * Query: q, categoryId, date, page, pageSize
 */
export async function GET(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const workspaceId = session.workspace.id;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const categoryId = searchParams.get("categoryId") || "";
  const date = (searchParams.get("date") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = session.supabase
    .from("leads")
    .select(
      "id, name, emails, phone, country, category, category_id, project_description, budget, lead_date, status, created_at",
      { count: "exact" }
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (date) {
    // lead_date is free text (e.g. 27-June-2026) — match contains for ISO or sheet formats
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

  // Post-filter for email matches (text[] isn't in the or() filter above)
  if (q) {
    const needle = q.toLowerCase();
    const emailHits = leads.filter((lead) =>
      (lead.emails || []).some((email) => String(email).toLowerCase().includes(needle))
    );
    if (needle.includes("@") || emailHits.length) {
      // Merge: keep rows that matched text filters OR email
      const byId = new Map(leads.map((lead) => [lead.id, lead]));
      for (const hit of emailHits) byId.set(hit.id, hit);
      leads = [...byId.values()];
    }
  }

  const total = count ?? leads.length;

  return NextResponse.json({
    leads,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
