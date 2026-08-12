"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";
import { CampaignDetailModal } from "@/components/campaigns/campaign-detail-modal";
import { CAMPAIGN_MAX_LEADS } from "@/lib/leads/categories";
import { getBudgetTier, getBudgetTierLabel } from "@/lib/leads/budget-tier";
import { notify } from "@/lib/notify";
import { fetchJson, queryKeys } from "@/lib/query";

const PICKER_PAGE_SIZE = 25;

function StatusBadge({ status }) {
  if (status === "sent" || status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {status === "completed" ? "Completed" : "Sent"}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  if (status === "scheduled" || status === "sending" || status === "generating") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Clock className="h-3.5 w-3.5" />
        {status}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-(--ink) px-2.5 py-1 text-xs font-medium capitalize text-(--on-ink)">
      {status}
    </span>
  );
}

function todaySheetDate() {
  const now = new Date();
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${now.getDate()}-${months[now.getMonth()]}-${now.getFullYear()}`;
}

function isoToSheetHint(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  if (!y || !m || !d) return isoDate;
  return `${d}-${months[m - 1]}-${y}`;
}

export default function CampaignsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState("pick"); // pick | generating | review | sending
  /** @type {"category" | "latest"} */
  const [pickMode, setPickMode] = useState("category");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [leadQuery, setLeadQuery] = useState("");
  const [pickerQ, setPickerQ] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [dateFilter, setDateFilter] = useState("");
  const [campaignId, setCampaignId] = useState(null);
  const [reviewLeads, setReviewLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [detailId, setDetailId] = useState(null);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => fetchJson("/api/leads/categories"),
    enabled: showForm,
    staleTime: 3 * 60_000,
  });
  const categories = categoriesQuery.data?.categories ?? [];

  useEffect(() => {
    if (!categories.length) return;
    setCategoryId((current) => current || categories[0].id);
  }, [categories]);

  const pickerQuery = useQuery({
    queryKey: queryKeys.leads({
      categoryId: pickMode === "category" ? categoryId : "",
      page: pickerPage,
      q: pickerQ,
      date: pickMode === "category" ? dateFilter : "",
      pageSize: PICKER_PAGE_SIZE,
      importRun: pickMode === "latest" ? "latest" : "",
    }),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(pickerPage),
        pageSize: String(PICKER_PAGE_SIZE),
      });
      if (pickMode === "latest") {
        params.set("importRun", "latest");
      } else {
        params.set("categoryId", categoryId);
        if (dateFilter) params.set("date", dateFilter);
      }
      if (pickerQ) params.set("q", pickerQ);
      return fetchJson(`/api/leads?${params}`);
    },
    enabled:
      showForm &&
      step === "pick" &&
      (pickMode === "latest" || Boolean(categoryId)),
    staleTime: 60_000,
  });

  const pickerLeads = pickerQuery.data?.leads ?? [];
  const latestImportRun = pickerQuery.data?.importRun ?? null;
  const pickerPagination = pickerQuery.data?.pagination ?? {
    page: pickerPage,
    pageSize: PICKER_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  };

  const categoryName = useMemo(
    () => categories.find((c) => c.id === categoryId)?.name || "subcategory",
    [categories, categoryId]
  );

  const loadCampaigns = useCallback(async (requestedPage = page) => {
    const response = await fetch(`/api/campaigns?page=${requestedPage}&pageSize=10`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to load campaigns.");
    setCampaigns(data.campaigns ?? []);
    setPagination(
      data.pagination ?? {
        page: requestedPage,
        pageSize: 10,
        total: data.campaigns?.length ?? 0,
        totalPages: 1,
      }
    );
  }, [page]);

  useEffect(() => {
    loadCampaigns(page)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, loadCampaigns]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true);
      router.replace("/campaigns", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (categoriesQuery.error) setError(categoriesQuery.error.message);
    else if (pickerQuery.error) setError(pickerQuery.error.message);
  }, [categoriesQuery.error, pickerQuery.error]);

  function toggleLead(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < CAMPAIGN_MAX_LEADS) next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const lead of pickerLeads) {
        if (next.size >= CAMPAIGN_MAX_LEADS) break;
        next.add(lead.id);
      }
      return next;
    });
  }

  async function selectMatchingLeads({ date, q = "" }) {
    setError("");
    setDateFilter(date || "");
    setPickerQ(q);
    setLeadQuery(q);
    setPickerPage(1);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: String(CAMPAIGN_MAX_LEADS),
      });
      if (pickMode === "latest") {
        params.set("importRun", "latest");
      } else {
        params.set("categoryId", categoryId);
        if (date) params.set("date", date);
      }
      if (q) params.set("q", q);

      const data = await fetchJson(`/api/leads?${params}`);
      const leads = data.leads ?? [];
      setSelectedIds(new Set(leads.slice(0, CAMPAIGN_MAX_LEADS).map((l) => l.id)));
      return leads;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }

  async function selectLatestImportAll() {
    setError("");
    setPickerPage(1);
    try {
      const params = new URLSearchParams({
        importRun: "latest",
        page: "1",
        pageSize: String(CAMPAIGN_MAX_LEADS),
      });
      if (pickerQ) params.set("q", pickerQ);
      const data = await fetchJson(`/api/leads?${params}`);
      const leads = data.leads ?? [];
      if (!leads.length) {
        notify.info("No latest import", "Import leads first, then come back to this tab.");
        setSelectedIds(new Set());
        return;
      }
      setSelectedIds(new Set(leads.slice(0, CAMPAIGN_MAX_LEADS).map((l) => l.id)));
      if (data.importRun?.categoryId) {
        setCategoryId(data.importRun.categoryId);
      } else if (leads[0]?.category_id) {
        setCategoryId(leads[0].category_id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectTodaysLeads() {
    const hint = todaySheetDate();
    const leads = await selectMatchingLeads({ date: hint, q: "" });
    if (!leads.length) {
      notify.info("No leads today", `Nothing matched “${hint}” in ${categoryName}.`);
    }
  }

  async function applyCalendarDate(iso) {
    const hint = isoToSheetHint(iso);
    await selectMatchingLeads({ date: hint || iso, q: "" });
  }

  async function refreshCampaignDetail(id) {
    const res = await fetch(`/api/campaigns/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setReviewLeads(data.leads ?? []);
    setStats(data.stats);
    return data;
  }

  async function runGenerateLoop(id) {
    setStep("generating");
    setBusy(true);
    setGenProgress("Generating personalized emails…");
    try {
      let done = false;
      while (!done) {
        const res = await fetch(`/api/campaigns/${id}/generate`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setGenProgress(
          data.done
            ? "Generation complete."
            : `Generated ${data.generated}… ${data.remaining} remaining`
        );
        done = Boolean(data.done);
        if (!done) await new Promise((r) => setTimeout(r, 120));
      }
      await refreshCampaignDetail(id);
      setStep("review");
      notify.success("Emails ready", "Review personalized messages before sending.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAndGenerate() {
    setError("");
    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Select at least one lead.");
      return;
    }

    const resolvedCategoryId =
      pickMode === "latest"
        ? latestImportRun?.categoryId ||
          pickerLeads.find((l) => selectedIds.has(l.id))?.category_id ||
          categoryId
        : categoryId;

    if (!resolvedCategoryId) {
      setError(
        pickMode === "latest"
          ? "Latest import has no subcategory. Re-import into a subcategory, or pick By subcategory."
          : "Pick a subcategory and at least one lead."
      );
      return;
    }
    if (selectedIds.size > CAMPAIGN_MAX_LEADS) {
      setError(`Select at most ${CAMPAIGN_MAX_LEADS} leads.`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          categoryId: resolvedCategoryId,
          leadIds: [...selectedIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCampaignId(data.campaign.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activation() }),
      ]);
      await runGenerateLoop(data.campaign.id);
      await loadCampaigns(1);
      setPage(1);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function saveLeadEdit(rowId, subject, bodyText) {
    if (!campaignId) return;
    const res = await fetch(`/api/campaigns/${campaignId}/leads/${rowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, bodyText }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await refreshCampaignDetail(campaignId);
  }

  async function skipLead(rowId) {
    if (!campaignId) return;
    const res = await fetch(`/api/campaigns/${campaignId}/leads/${rowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await refreshCampaignDetail(campaignId);
  }

  async function handleStartSending() {
    if (!campaignId) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetch("/api/settings/process-scheduled", { method: "POST" });
      setStep("sending");
      notify.success("Sending started", `${data.queued} emails queued.`);
      await refreshCampaignDetail(campaignId);
      await loadCampaigns(page);

      const timer = setInterval(async () => {
        try {
          await fetch("/api/settings/process-scheduled", { method: "POST" });
          const detail = await refreshCampaignDetail(campaignId);
          if (detail.campaign?.status === "completed") {
            clearInterval(timer);
            notify.success("Campaign finished", "All queued emails were processed.");
            await loadCampaigns(page);
          }
        } catch {
          // keep polling
        }
      }, 15000);

      setTimeout(() => clearInterval(timer), 30 * 60 * 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setShowForm(false);
    setStep("pick");
    setPickMode("category");
    setName("");
    setSelectedIds(new Set());
    setCampaignId(null);
    setReviewLeads([]);
    setStats(null);
    setGenProgress("");
    setDateFilter("");
    setLeadQuery("");
    setPickerQ("");
    setPickerPage(1);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">
            Select leads from a subcategory, generate personalized emails, then send.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(true);
            setStep("pick");
          }}
        >
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {showForm ? (
        <Card
          title={
            step === "pick"
              ? "Create campaign"
              : step === "generating"
                ? "Generating"
                : step === "review"
                  ? "Review emails"
                  : "Sending"
          }
          description={
            step === "pick"
              ? `Pick up to ${CAMPAIGN_MAX_LEADS} leads. Each person gets their own AI email.`
              : genProgress || undefined
          }
        >
          {step === "pick" ? (
            <div className="space-y-4">
              <Input
                label="Campaign name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="June website outreach"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pickMode === "category" ? "primary" : "secondary"}
                  onClick={() => {
                    setPickMode("category");
                    setSelectedIds(new Set());
                    setPickerPage(1);
                    setDateFilter("");
                  }}
                >
                  By subcategory
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pickMode === "latest" ? "primary" : "secondary"}
                  onClick={() => {
                    setPickMode("latest");
                    setSelectedIds(new Set());
                    setPickerPage(1);
                    setDateFilter("");
                    setPickerQ("");
                    setLeadQuery("");
                  }}
                >
                  Latest import
                </Button>
              </div>

              {pickMode === "category" ? (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-(--heading)">Subcategory</span>
                  <select
                    className="h-11 w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 text-sm outline-none focus:border-(--ink)"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSelectedIds(new Set());
                      setPickerPage(1);
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.leadCount ?? 0})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-xl border border-(--ink)/10 bg-(--surface-lo)/50 px-3.5 py-3 text-sm text-(--body)">
                  {pickerQuery.isLoading ? (
                    <p className="text-(--muted-text)">Loading latest import…</p>
                  ) : latestImportRun ? (
                    <p>
                      Showing{" "}
                      <span className="font-medium text-(--heading)">
                        {pickerPagination.total || latestImportRun.leadCount}
                      </span>{" "}
                      lead{(pickerPagination.total || latestImportRun.leadCount) === 1 ? "" : "s"}{" "}
                      from the most recent import
                      <span className="text-(--muted-text)">
                        {" "}
                        · {String(latestImportRun.source).replace(/^./, (c) => c.toUpperCase())}
                        {" · "}
                        {new Date(latestImportRun.createdAt).toLocaleString()}
                      </span>
                    </p>
                  ) : (
                    <p className="text-(--muted-text)">
                      No imports yet. Import leads from Leads (paste, HubSpot, or Zoho), then
                      return here.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Search leads"
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                    placeholder="Name, email, phone, service…"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDateFilter("");
                    setPickerPage(1);
                    setPickerQ(leadQuery.trim());
                  }}
                >
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {pickMode === "category" ? (
                  <>
                    <Button type="button" size="sm" variant="secondary" onClick={selectTodaysLeads}>
                      <Calendar className="h-3.5 w-3.5" />
                      Select today&apos;s leads in {categoryName}
                    </Button>
                    <label className="inline-flex h-9 items-center gap-2 rounded-xl border border-(--ink)/12 px-3 text-xs text-(--body)">
                      <Calendar className="h-3.5 w-3.5" />
                      <input
                        type="date"
                        className="bg-transparent outline-none"
                        value={
                          dateFilter.includes("-") && dateFilter.match(/^\d{4}-/) ? dateFilter : ""
                        }
                        onChange={(e) => applyCalendarDate(e.target.value)}
                      />
                    </label>
                    <Button type="button" size="sm" variant="ghost" onClick={selectAllVisible}>
                      Select all shown
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={selectLatestImportAll}
                    disabled={!latestImportRun}
                  >
                    Select all from latest import
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>

              <p className="text-xs text-(--muted-text)">
                Selected {selectedIds.size} / {CAMPAIGN_MAX_LEADS}
                {pickerPagination.total
                  ? ` · ${pickerPagination.total} lead${pickerPagination.total === 1 ? "" : "s"} in view`
                  : ""}
                {pickMode === "category" && dateFilter ? ` · filter: ${dateFilter}` : ""}
              </p>

              <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-(--ink)/10 p-2">
                {pickerQuery.isLoading ? (
                  <p className="p-3 text-sm text-(--muted-text)">Loading…</p>
                ) : pickerLeads.length === 0 ? (
                  <p className="p-3 text-sm text-(--muted-text)">
                    {pickMode === "latest" ? "No leads in the latest import." : "No leads match."}
                  </p>
                ) : (
                  pickerLeads.map((lead) => {
                    const checked = selectedIds.has(lead.id);
                    const budget = lead.budget || "";
                    const tier = budget ? getBudgetTierLabel(getBudgetTier(budget)) : "";
                    return (
                      <label
                        key={lead.id}
                        className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-(--ink)/4"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0 accent-(--ink)"
                          checked={checked}
                          onChange={() => toggleLead(lead.id)}
                        />
                        <span className="min-w-0 flex-1 overflow-hidden">
                          <span className="flex min-w-0 items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-(--heading)">
                              {lead.name}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-(--body)">
                              {budget || "No budget"}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-(--muted-text)">
                            {(lead.emails || []).join(", ")}
                            {lead.lead_date ? ` · ${lead.lead_date}` : ""}
                            {tier ? ` · ${tier}` : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <Pagination
                page={pickerPagination.page}
                totalPages={pickerPagination.totalPages}
                total={pickerPagination.total}
                pageSize={pickerPagination.pageSize}
                onPageChange={(nextPage) => setPickerPage(nextPage)}
              />

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCreateAndGenerate} loading={busy}>
                  <Sparkles className="h-4 w-4" />
                  Generate personalized emails
                </Button>
                <Button variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {step === "generating" ? (
            <div className="flex items-center gap-3 text-sm text-(--body)">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {genProgress || "Working…"}
            </div>
          ) : null}

          {step === "review" || step === "sending" ? (
            <div className="space-y-4">
              {stats ? (
                <p className="text-xs text-(--muted-text)">
                  {stats.generated + stats.queued + stats.sending + stats.sent} ready ·{" "}
                  {stats.failed} failed · {stats.skipped} skipped · {stats.pending} pending
                </p>
              ) : null}

              <div className="space-y-2">
                {reviewLeads.map((row) => {
                  const lead = row.leads;
                  const open = expandedId === row.id;
                  return (
                    <div
                      key={row.id}
                      className="rounded-xl border border-(--ink)/10"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                        onClick={() => setExpandedId(open ? null : row.id)}
                      >
                        <div>
                          <p className="text-sm font-medium text-(--heading)">
                            {lead?.name}{" "}
                            <span className="font-normal text-(--muted-text)">
                              · {row.status}
                            </span>
                          </p>
                          <p className="truncate text-xs text-(--muted-text)">
                            {row.subject || "No subject yet"}
                          </p>
                        </div>
                        {open ? (
                          <ChevronUp className="h-4 w-4 text-(--muted-text)" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-(--muted-text)" />
                        )}
                      </button>
                      {open ? (
                        <div className="space-y-3 border-t border-(--ink)/10 p-3">
                          <Input
                            label="Subject"
                            defaultValue={row.subject || ""}
                            id={`sub-${row.id}`}
                          />
                          <Textarea
                            label="Body"
                            defaultValue={row.body_text || ""}
                            id={`body-${row.id}`}
                            className="min-h-[140px]"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                const subject = document.getElementById(`sub-${row.id}`)?.value;
                                const bodyText = document.getElementById(`body-${row.id}`)?.value;
                                saveLeadEdit(row.id, subject, bodyText).catch((err) =>
                                  setError(err.message)
                                );
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => skipLead(row.id).catch((err) => setError(err.message))}
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                              Skip
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {step === "review" ? (
                  <>
                    <Button onClick={handleStartSending} loading={busy}>
                      <Send className="h-4 w-4" />
                      Start sending
                    </Button>
                    <Button
                      variant="secondary"
                      loading={busy}
                      onClick={() => campaignId && runGenerateLoop(campaignId)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry failed
                    </Button>
                  </>
                ) : null}
                <Button variant="ghost" onClick={resetForm}>
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card title="Your campaigns" description="Click a campaign to see recipients and emails.">
        {loading ? (
          <p className="text-sm text-(--muted-text)">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-(--muted-text)">
            No campaigns yet. Create one from a subcategory of leads.
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setDetailId(campaign.id)}
                className="flex w-full flex-col gap-2 rounded-xl border border-(--ink)/10 px-4 py-3 text-left transition hover:border-(--ink)/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Megaphone className="h-4 w-4 text-(--muted-text)" />
                    <p className="font-medium text-(--heading)">{campaign.name}</p>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-(--muted-text)">
                    {campaign.subject || "Personalized per recipient"} ·{" "}
                    {campaign.recipientCount ?? campaign.recipients?.length ?? 0} recipients
                  </p>
                </div>
                <p className="shrink-0 text-xs text-(--muted-text)">
                  {new Date(campaign.created_at).toLocaleString()}
                </p>
              </button>
            ))}
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      <CampaignDetailModal
        open={Boolean(detailId)}
        campaignId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
