import { NextResponse } from "next/server";
import { requireWorkspaceSession } from "@/lib/auth/get-session";

const VALID_STATUSES = new Set(["sent", "failed", "scheduled", "draft"]);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * @param {import("next/server").NextRequest} request
 */
export async function GET(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "all";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = session.supabase
    .from("emails")
    .select(
      "id, subject, recipients, status, sent_at, scheduled_at, created_at, error_message, sent_by, campaign_id, body_html, body_text, ai_provider, ai_prompt",
      { count: "exact" }
    )
    .eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false });

  if (status !== "all" && VALID_STATUSES.has(status)) {
    query = query.eq("status", status);
  }

  if (q) {
    // Strip PostgREST filter syntax characters before interpolating into `or`.
    const safeQuery = q.replace(/[%_,().]/g, " ").trim();
    if (safeQuery) {
      const filters = [
        `subject.ilike.%${safeQuery}%`,
        `body_text.ilike.%${safeQuery}%`,
      ];
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeQuery)) {
        filters.push(`recipients.cs.{${safeQuery.toLowerCase()}}`);
      }
      query = query.or(filters.join(","));
    }
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    emails: data ?? [],
    total,
    page,
    pageSize,
    totalPages,
  });
}
