import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspaceSession } from "@/lib/auth/get-session";
import {
  ensureDefaultLeadCategories,
  slugifyCategoryName,
} from "@/lib/leads/categories";

const createSchema = z.object({
  name: z.string().min(1, "Category name is required.").max(80),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function GET() {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const workspaceId = session.workspace.id;
  await ensureDefaultLeadCategories(session.supabase, workspaceId);

  const { data, error } = await session.supabase
    .from("lead_categories")
    .select("id, name, slug, created_at")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categories = data ?? [];
  const counts = await Promise.all(
    categories.map(async (category) => {
      const { count } = await session.supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("category_id", category.id);
      return { id: category.id, count: count ?? 0 };
    })
  );

  const countMap = Object.fromEntries(counts.map((item) => [item.id, item.count]));

  return NextResponse.json({
    categories: categories.map((category) => ({
      ...category,
      leadCount: countMap[category.id] ?? 0,
    })),
  });
}

export async function POST(request) {
  const { session, error: sessionError } = await requireWorkspaceSession();
  if (sessionError) return sessionError;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const workspaceId = session.workspace.id;
  const name = parsed.data.name.trim();
  let slug = slugifyCategoryName(name);

  const { data: clash } = await session.supabase
    .from("lead_categories")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (clash) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const { data, error } = await session.supabase
    .from("lead_categories")
    .insert({ workspace_id: workspaceId, name, slug })
    .select("id, name, slug, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: { ...data, leadCount: 0 } });
}
