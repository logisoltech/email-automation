import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";

const VALID_STATUSES = new Set(["sent", "failed", "scheduled", "draft"]);

/**
 * @param {string} value
 */
function matchesSearch(value, term) {
  return value?.toLowerCase().includes(term) ?? false;
}

/**
 * @param {import("next/server").NextRequest} request
 */
export async function GET(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "all";
  const searchTerm = q.toLowerCase();
  const fetchLimit = q ? 500 : 100;

  let query = session.supabase
    .from("emails")
    .select(
      "id, subject, recipients, status, sent_at, scheduled_at, created_at, error_message, sent_by, campaign_id, body_html, body_text, ai_provider, ai_prompt"
    )
    .order("created_at", { ascending: false })
    .limit(fetchLimit);

  if (status !== "all" && VALID_STATUSES.has(status)) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let emails = data ?? [];

  if (searchTerm) {
    emails = emails.filter(
      (email) =>
        matchesSearch(email.subject, searchTerm) ||
        matchesSearch(email.body_text, searchTerm) ||
        matchesSearch(email.body_html, searchTerm) ||
        email.recipients?.some((recipient) => matchesSearch(recipient, searchTerm))
    );
  }

  return NextResponse.json({
    emails: emails.slice(0, 100),
    total: emails.length,
  });
}
