import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TRANSPARENT_GIF } from "@/lib/email/tracking";
import { pushStatusForRecipients } from "@/lib/integrations/push-status";

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(TRANSPARENT_GIF.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Public open-tracking pixel. Always returns a 1×1 GIF.
 * @param {import("next/server").NextRequest} _request
 * @param {{ params: Promise<{ token: string }> }} context
 */
export async function GET(_request, { params }) {
  const { token: raw } = await params;
  const token = String(raw || "")
    .replace(/\.gif$/i, "")
    .trim();

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    try {
      const supabase = createAdminClient();
      const { data: email } = await supabase
        .from("emails")
        .select("id, opened_at, open_count, status, workspace_id, recipients")
        .eq("tracking_token", token)
        .maybeSingle();

      if (email?.id && email.status === "sent") {
        const firstOpen = !email.opened_at;
        await supabase
          .from("emails")
          .update({
            opened_at: email.opened_at || new Date().toISOString(),
            open_count: (email.open_count || 0) + 1,
          })
          .eq("id", email.id);

        if (firstOpen && email.workspace_id && email.recipients?.length) {
          void pushStatusForRecipients(email.workspace_id, email.recipients, "opened");
        }
      }
    } catch {
      // Never fail the pixel response
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: PIXEL_HEADERS,
  });
}
