"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardPaste,
  Plus,
  Search,
  Users,
  FolderPlus,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";
import { getBudgetTier, getBudgetTierLabel } from "@/lib/leads/budget-tier";
import { notify } from "@/lib/notify";
import { fetchJson, queryKeys } from "@/lib/query";

const PAGE_SIZE = 25;

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [assignCategoryId, setAssignCategoryId] = useState("");

  const [rawPaste, setRawPaste] = useState("");
  const [importCategoryId, setImportCategoryId] = useState("");
  const [previewLeads, setPreviewLeads] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => fetchJson("/api/leads/categories"),
    staleTime: 3 * 60_000,
  });

  const categories = categoriesQuery.data?.categories ?? [];

  useEffect(() => {
    if (!categories.length) return;
    setActiveCategoryId((current) => {
      if (current && categories.some((c) => c.id === current)) return current;
      return categories[0].id;
    });
    setImportCategoryId((current) => current || categories[0].id);
    setAssignCategoryId((current) => current || categories[0].id);
  }, [categories]);

  const leadsQuery = useQuery({
    queryKey: queryKeys.leads({
      categoryId: activeCategoryId,
      page,
      q,
      pageSize: PAGE_SIZE,
    }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (activeCategoryId) params.set("categoryId", activeCategoryId);
      if (q) params.set("q", q);
      return fetchJson(`/api/leads?${params}`);
    },
    enabled: Boolean(activeCategoryId),
    staleTime: 60_000,
  });

  const leads = leadsQuery.data?.leads ?? [];
  const pagination = leadsQuery.data?.pagination ?? {
    page,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  const showLeadsLoading = leadsQuery.isLoading;
  const showCategoriesLoading = categoriesQuery.isLoading && !categories.length;

  useEffect(() => {
    setSelected(new Set());
  }, [activeCategoryId, q, page]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCategoryId) || null,
    [categories, activeCategoryId]
  );

  const createCategoryMutation = useMutation({
    mutationFn: (name) =>
      fetchJson("/api/leads/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (data) => {
      setNewCategoryName("");
      notify.success("Subcategory created", data.category?.name || "Created");
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories() });
      if (data.category?.id) {
        setActiveCategoryId(data.category.id);
        setPage(1);
      }
    },
    onError: (err) => setError(err.message),
  });

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setError("");
    createCategoryMutation.mutate(name);
  }

  async function handlePreviewParse() {
    setError("");
    setImporting(true);
    try {
      const data = await fetchJson("/api/leads/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: rawPaste }),
      });
      setPreviewLeads(data.leads ?? []);
      setParseErrors(data.errors ?? []);
      if (!(data.leads?.length > 0)) {
        setError("No valid leads found in the paste.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleImport() {
    if (!importCategoryId || !previewLeads.length) return;
    setImporting(true);
    setError("");
    try {
      const data = await fetchJson("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: importCategoryId,
          leads: previewLeads,
        }),
      });
      notify.success("Leads imported", `${data.imported} leads added.`);
      setRawPaste("");
      setPreviewLeads([]);
      setParseErrors([]);
      setShowImport(false);
      setActiveCategoryId(importCategoryId);
      setPage(1);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories() }),
        queryClient.invalidateQueries({ queryKey: ["leads", "list"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activation() }),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  function toggleLead(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((lead) => lead.id)));
    }
  }

  async function handleAssign() {
    if (!assignCategoryId || selected.size === 0) return;
    setError("");
    try {
      const data = await fetchJson("/api/leads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: [...selected],
          categoryId: assignCategoryId,
        }),
      });
      notify.success("Leads updated", `Moved ${data.updated} lead(s).`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories() }),
        queryClient.invalidateQueries({ queryKey: ["leads", "list"] }),
      ]);
    } catch (err) {
      setError(err.message);
    }
  }

  const displayError =
    error || categoriesQuery.error?.message || leadsQuery.error?.message || "";

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Leads</h1>
          <p className="page-subtitle">
            Import contacts, organize them into subcategories, then launch a campaign.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowImport((v) => !v)}>
            <ClipboardPaste className="h-4 w-4" />
            {showImport ? "Hide import" : "Import leads"}
          </Button>
          <Link href="/campaigns?new=1">
            <Button>
              <Plus className="h-4 w-4" />
              Create a Campaign
            </Button>
          </Link>
        </div>
      </div>

      {displayError ? <Alert variant="error">{displayError}</Alert> : null}

      {showImport ? (
        <Card title="Import from Google Sheets" description="Paste tab-separated rows. No emails are generated here.">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-(--heading)">Subcategory</span>
                <select
                  className="h-11 w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 text-sm text-(--heading) outline-none focus:border-(--ink)"
                  value={importCategoryId}
                  onChange={(e) => setImportCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Textarea
              label="Paste rows"
              value={rawPaste}
              onChange={(e) => setRawPaste(e.target.value)}
              placeholder="Date	Name	Country	Category	Email	Phone	Project…"
              className="min-h-[160px] font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handlePreviewParse} loading={importing}>
                Preview parse
              </Button>
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={!previewLeads.length || !importCategoryId}
              >
                Import {previewLeads.length || ""} leads
              </Button>
            </div>
            {parseErrors.length ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {parseErrors.slice(0, 8).map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
                {parseErrors.length > 8 ? <p>+{parseErrors.length - 8} more</p> : null}
              </div>
            ) : null}
            {previewLeads.length ? (
              <div className="max-w-full overflow-x-auto rounded-xl border border-(--ink)/10">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-(--ink)/4 text-xs uppercase tracking-wide text-(--muted-text)">
                    <tr>
                      <th className="w-[18%] px-3 py-2">Name</th>
                      <th className="w-[26%] px-3 py-2">Email</th>
                      <th className="w-[16%] px-3 py-2">Phone</th>
                      <th className="w-[22%] px-3 py-2">Service</th>
                      <th className="w-[18%] px-3 py-2">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewLeads.slice(0, 20).map((lead, index) => (
                      <tr key={`${lead.name}-${index}`} className="border-t border-(--ink)/8">
                        <td className="truncate px-3 py-2 font-medium text-(--heading)" title={lead.name}>
                          {lead.name}
                        </td>
                        <td
                          className="truncate px-3 py-2 text-(--body)"
                          title={lead.emails?.[0] || ""}
                        >
                          {lead.emails?.[0]}
                        </td>
                        <td className="truncate px-3 py-2 text-(--body)" title={lead.phone || ""}>
                          {lead.phone || "—"}
                        </td>
                        <td
                          className="truncate px-3 py-2 text-(--body)"
                          title={lead.category || ""}
                        >
                          {lead.category || "—"}
                        </td>
                        <td className="truncate px-3 py-2 text-(--muted-text)">
                          {lead.budget || "—"}
                          {lead.budget ? (
                            <span className="ml-1 text-[10px] uppercase">
                              ({getBudgetTierLabel(getBudgetTier(lead.budget))})
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewLeads.length > 20 ? (
                  <p className="border-t border-(--ink)/8 px-3 py-2 text-xs text-(--muted-text)">
                    Showing 20 of {previewLeads.length}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <Card className="h-fit min-w-0">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-(--muted-text)">
            Subcategories
          </p>
          <div className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setActiveCategoryId(category.id);
                  setPage(1);
                }}
                className={
                  category.id === activeCategoryId
                    ? "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-(--ink) px-3 py-2 text-left text-sm font-medium text-(--on-ink)"
                    : "flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm text-(--body) transition hover:bg-(--ink)/5"
                }
              >
                <span className="truncate">{category.name}</span>
                <span className="shrink-0 text-xs opacity-70">{category.leadCount ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-(--ink)/10 pt-4">
            <Input
              label="New subcategory"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Mobile App"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCreateCategory}
              loading={createCategoryMutation.isPending}
              className="w-full"
            >
              <FolderPlus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </Card>

        <div className="min-w-0 space-y-4 overflow-hidden">
          <Card className="min-w-0 overflow-hidden">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  label="Search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPage(1);
                      setQ(searchInput.trim());
                    }
                  }}
                  placeholder="Name, email, phone, Website Development…"
                />
              </div>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  setPage(1);
                  setQ(searchInput.trim());
                }}
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>

            {selected.size > 0 ? (
              <div className="mt-4 flex min-w-0 flex-col gap-3 rounded-xl border border-(--ink)/10 bg-(--ink)/3 p-3 sm:flex-row sm:items-end">
                <p className="shrink-0 text-sm text-(--body)">
                  <Users className="mr-1 inline h-4 w-4" />
                  {selected.size} selected
                </p>
                <label className="block min-w-0 flex-1 text-sm">
                  <span className="mb-1 block text-xs text-(--muted-text)">Move to</span>
                  <select
                    className="h-10 w-full max-w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3 text-sm outline-none"
                    value={assignCategoryId}
                    onChange={(e) => setAssignCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button size="sm" className="shrink-0" onClick={handleAssign}>
                  Assign
                </Button>
              </div>
            ) : null}
          </Card>

          <Card
            className="min-w-0 overflow-hidden"
            title={activeCategory?.name || "Leads"}
            description={`${pagination.total} lead${pagination.total === 1 ? "" : "s"}`}
          >
            {showCategoriesLoading || showLeadsLoading ? (
              <p className="text-sm text-(--muted-text)">Loading…</p>
            ) : leads.length === 0 ? (
              <p className="text-sm text-(--muted-text)">
                No leads in this subcategory yet. Import some or clear your search.
              </p>
            ) : (
              <div className="min-w-0 space-y-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="mb-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-(--muted-text) hover:text-(--heading)"
                >
                  {selected.size === leads.length ? (
                    <CheckSquare className="h-3.5 w-3.5" />
                  ) : (
                    <Square className="h-3.5 w-3.5" />
                  )}
                  Select all on page
                </button>

                {leads.map((lead) => {
                  const checked = selected.has(lead.id);
                  const emailLine = [
                    (lead.emails || []).join(", "),
                    lead.phone ? lead.phone : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const detailLine =
                    [lead.category, lead.project_description].filter(Boolean).join(" — ") ||
                    "No project details";

                  return (
                    <label
                      key={lead.id}
                      className="flex min-w-0 cursor-pointer items-start gap-3 overflow-hidden rounded-xl border border-(--ink)/10 px-3 py-3 transition hover:border-(--ink)/25"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLead(lead.id)}
                        className="mt-1 shrink-0 accent-(--ink)"
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <p className="truncate font-medium text-(--heading)" title={lead.name}>
                            {lead.name}
                          </p>
                          <p className="shrink-0 text-xs text-(--muted-text)">
                            {lead.lead_date || ""}
                          </p>
                        </div>
                        <p className="truncate text-sm text-(--body)" title={emailLine}>
                          {emailLine || "—"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-(--muted-text)" title={detailLine}>
                          {detailLine}
                        </p>
                      </div>
                    </label>
                  );
                })}

                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(nextPage) => setPage(nextPage)}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
