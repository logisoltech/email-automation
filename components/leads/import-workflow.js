"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardPaste,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
  SkipForward,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";
import { SendProgressPanel } from "@/components/leads/send-progress-panel";
import { getBudgetTier, getBudgetTierLabel } from "@/lib/leads/budget-tier";

const PAGE_SIZE = 10;

/**
 * @param {{
 *   type: "website" | "smm";
 *   title: string;
 *   description: string;
 * }} props
 */
export function ImportLeadsWorkflow({ type, title, description }) {
  const [step, setStep] = useState("paste");
  const [rawPaste, setRawPaste] = useState("");
  const [batchName, setBatchName] = useState("");
  const [previewLeads, setPreviewLeads] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [batchId, setBatchId] = useState(null);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [batch, setBatch] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [previewPage, setPreviewPage] = useState(1);
  const [warningPage, setWarningPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPagination, setReviewPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const processingRef = useRef(false);

  const loadBatch = useCallback(async (id, requestedPage = reviewPage) => {
    const res = await fetch(
      `/api/leads/batches/${id}?page=${requestedPage}&pageSize=${PAGE_SIZE}`
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setBatch(data.batch);
    setLeads(data.leads);
    setStats(data.stats);
    setReviewPagination(
      data.pagination ?? {
        page: requestedPage,
        pageSize: PAGE_SIZE,
        total: data.leads?.length ?? 0,
        totalPages: 1,
      }
    );
    if (data.batch?.status === "completed") {
      setStep("sending");
      setSuccess(
        `Batch finished — ${data.stats?.sent ?? 0} sent${
          data.stats?.failed ? `, ${data.stats.failed} failed` : ""
        }.`
      );
    }
    return data;
  }, [reviewPage]);

  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      return null;
    }

    processingRef.current = true;

    try {
      const res = await fetch("/api/settings/process-scheduled", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } finally {
      processingRef.current = false;
    }
  }, []);

  // Refresh progress often while sending; kick the queue about once a minute.
  useEffect(() => {
    if (!batchId || step !== "sending") return;
    if (batch?.status === "completed") return;

    const refresh = setInterval(() => {
      loadBatch(batchId).catch(() => {});
    }, 15000);

    const process = setInterval(() => {
      processQueue()
        .then(() => loadBatch(batchId))
        .catch(() => {});
    }, 60000);

    return () => {
      clearInterval(refresh);
      clearInterval(process);
    };
  }, [batchId, step, batch?.status, loadBatch, processQueue]);

  async function handleParse() {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/leads/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: rawPaste }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setPreviewLeads(data.leads);
      setParseErrors(data.errors ?? []);
      setPreviewPage(1);
      setWarningPage(1);

      if (!data.leads.length) {
        setError("No valid leads found. Check your paste format.");
        return;
      }

      const meta = data.meta;
      const metaNote = meta
        ? ` Found ${meta.reconstructedRows} lead rows${meta.skippedBlankLines ? ` (${meta.skippedBlankLines} empty lines skipped)` : ""}.`
        : "";
      setSuccess(`Parsed ${data.leads.length} leads.${metaNote}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runGenerateLoop(id) {
    let done = false;
    while (!done) {
      setGenProgress("Generating personalized emails...");
      const genRes = await fetch(`/api/leads/batches/${id}/generate`, { method: "POST" });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error);

      setGenProgress(`${genData.remaining} leads remaining...`);
      done = genData.done;

      if (!done) {
        await sleep(100);
      }
    }
  }

  async function handleCreateAndGenerate() {
    setError("");
    setSuccess("");
    setGenerating(true);
    setGenProgress("Creating batch...");

    try {
      const createRes = await fetch("/api/leads/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: batchName || `${type} import ${new Date().toLocaleDateString()}`,
          leads: previewLeads,
          sendsPerHour: 100,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error);

      const id = createData.batch.id;
      setBatchId(id);
      setReviewPage(1);
      setStep("generating");

      await runGenerateLoop(id);

      await loadBatch(id);
      setStep("review");
      setSuccess("All emails generated. Review before sending.");
    } catch (err) {
      setError(err.message);
      setStep("paste");
    } finally {
      setGenerating(false);
      setGenProgress("");
    }
  }

  async function handleRetryFailed() {
    if (!batchId) return;

    setError("");
    setSuccess("");
    setGenerating(true);
    setStep("generating");

    try {
      await runGenerateLoop(batchId);
      await loadBatch(batchId);
      setStep("review");
      setSuccess("Failed leads retried.");
    } catch (err) {
      setError(err.message);
      setStep("review");
    } finally {
      setGenerating(false);
      setGenProgress("");
    }
  }

  async function handleSaveLead(lead) {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: lead.subject,
        bodyText: lead.body_text,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (batchId) await loadBatch(batchId);
  }

  async function handleSkipLead(leadId) {
    await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "skipped" }),
    });
    if (batchId) await loadBatch(batchId);
  }

  async function handleStartSending() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/leads/batches/${batchId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await loadBatch(batchId);
      setStep("sending");
      setSuccess(
        `Sending started — up to ${data.sendsPerHour} emails per hour. ${data.queued} in queue.`
      );

      try {
        const processData = await processQueue();
        await loadBatch(batchId);
        if (processData.message) {
          setSuccess(processData.message);
        }
      } catch {
        // Queue will retry on the next auto-process tick.
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessNow() {
    setLoading(true);
    try {
      const data = await processQueue();
      if (batchId) await loadBatch(batchId);
      setSuccess(data.message || "Processed queue.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateLeadField(id, field, value) {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === id ? { ...lead, [field]: value } : lead))
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {success ? <Alert variant="success">{success}</Alert> : null}

      {(step === "paste" || step === "generating") && (
        <>
          <Card title="Paste leads" description="Copy rows from Google Sheets and paste below (tab-separated).">
            <div className="space-y-4">
              <Input
                label="Batch name"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder={`${type} leads - ${new Date().toLocaleDateString()}`}
              />
              <Textarea
                label="Leads data"
                value={rawPaste}
                onChange={(e) => setRawPaste(e.target.value)}
                className="min-h-50 font-mono text-xs"
                placeholder="Paste rows from Google Sheets here..."
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={handleParse} loading={loading} variant="secondary">
                  <ClipboardPaste className="h-4 w-4" />
                  Preview parse
                </Button>
                <Button
                  onClick={handleCreateAndGenerate}
                  loading={generating}
                  disabled={!previewLeads.length}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate personalized emails
                </Button>
              </div>
              {genProgress ? (
                <p className="text-sm font-medium text-(--heading)">{genProgress}</p>
              ) : null}
            </div>
          </Card>

          {parseErrors.length > 0 ? (
            <Card title="Parse warnings">
              <ul className="space-y-1 text-sm text-amber-700">
                {parseErrors
                  .slice((warningPage - 1) * PAGE_SIZE, warningPage * PAGE_SIZE)
                  .map((msg, index) => (
                  <li key={`${warningPage}-${index}-${msg}`}>{msg}</li>
                ))}
              </ul>
              <Pagination
                page={warningPage}
                totalPages={Math.max(1, Math.ceil(parseErrors.length / PAGE_SIZE))}
                total={parseErrors.length}
                pageSize={PAGE_SIZE}
                onPageChange={setWarningPage}
              />
            </Card>
          ) : null}

          {previewLeads.length > 0 ? (
            <Card title={`Preview (${previewLeads.length} leads)`}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-(--muted-text)">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Budget</th>
                      <th className="py-2">Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewLeads
                      .slice(
                        (previewPage - 1) * PAGE_SIZE,
                        previewPage * PAGE_SIZE
                      )
                      .map((lead) => (
                      <tr key={lead.sortOrder} className="border-b border-slate-100">
                        <td className="py-2 pr-4 font-medium">{lead.name}</td>
                        <td className="py-2 pr-4 text-xs">{lead.emails.join(", ")}</td>
                        <td className="py-2 pr-4">{lead.category}</td>
                        <td className="py-2 pr-4">
                          <div className="space-y-1">
                            <p className="text-xs text-(--body)">{lead.budget || "—"}</p>
                            <BudgetTierBadge budget={lead.budget} />
                          </div>
                        </td>
                        <td className="max-w-xs truncate py-2 text-(--body)">
                          {lead.projectDescription}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  page={previewPage}
                  totalPages={Math.max(1, Math.ceil(previewLeads.length / PAGE_SIZE))}
                  total={previewLeads.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPreviewPage}
                />
              </div>
            </Card>
          ) : null}
        </>
      )}

      {(step === "review" || step === "sending") && leads.length > 0 ? (
        <>
          <Card
            title={batch?.status === "completed" ? "Send complete" : "Review emails"}
            description={
              step === "sending"
                ? batch?.status === "completed"
                  ? "This batch finished sending."
                  : `Sending at ${batch?.sends_per_hour ?? 100}/hour. Progress updates every few seconds; the queue drains automatically in production.`
                : "Edit any email, skip leads you don't want, then start sending."
            }
          >
            {step === "sending" ? (
              <SendProgressPanel
                stats={stats}
                sendsPerHour={batch?.sends_per_hour ?? 100}
                batchStatus={batch?.status}
              />
            ) : null}

            {stats && step !== "sending" ? (
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1">Total: {stats.total}</span>
                <span className="rounded-full bg-(--ink) px-2 py-1 text-(--on-ink)">
                  Ready: {stats.generated}
                </span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                  Queued: {stats.queued}
                </span>
                <span className="rounded-full bg-green-50 px-2 py-1 text-green-700">
                  Sent: {stats.sent}
                </span>
                <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">
                  Failed: {stats.failed}
                </span>
              </div>
            ) : null}

            <div className="space-y-3">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-(--ink)/10 bg-(--surface) p-4 transition hover:border-(--ink)/25"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 text-left"
                    onClick={() =>
                      setExpandedId(expandedId === lead.id ? null : lead.id)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-(--heading)">{lead.name}</span>
                        <StatusPill status={lead.status} />
                      </div>
                      <p className="mt-1 text-xs text-(--muted-text)">
                        {lead.emails?.join(", ")} · {lead.category}
                        {lead.budget ? ` · ${lead.budget}` : ""}
                      </p>
                      <div className="mt-1">
                        <BudgetTierBadge budget={lead.budget} />
                      </div>
                      {lead.subject ? (
                        <p className="mt-1 text-sm text-(--body)">{lead.subject}</p>
                      ) : null}
                    </div>
                    {expandedId === lead.id ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-(--muted-text)" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-(--muted-text)" />
                    )}
                  </button>

                  {expandedId === lead.id ? (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <p className="text-xs text-(--muted-text)">{lead.project_description}</p>
                      <Input
                        label="Subject"
                        value={lead.subject || ""}
                        onChange={(e) => updateLeadField(lead.id, "subject", e.target.value)}
                        disabled={lead.status !== "generated" && lead.status !== "queued"}
                      />
                      <Textarea
                        label="Body"
                        value={lead.body_text || ""}
                        onChange={(e) => updateLeadField(lead.id, "body_text", e.target.value)}
                        className="min-h-40 whitespace-pre-wrap"
                        disabled={lead.status !== "generated" && lead.status !== "queued"}
                      />
                      {lead.error_message ? (
                        <p className="text-sm text-red-600">{lead.error_message}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {(lead.status === "generated" || lead.status === "queued") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSaveLead(lead)}
                          >
                            Save edits
                          </Button>
                        )}
                        {lead.status === "generated" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSkipLead(lead.id)}
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                            Skip
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <Pagination
              page={reviewPagination.page}
              totalPages={reviewPagination.totalPages}
              total={reviewPagination.total}
              pageSize={reviewPagination.pageSize}
              disabled={loading || generating}
              onPageChange={(nextPage) => {
                setExpandedId(null);
                setReviewPage(nextPage);
                loadBatch(batchId, nextPage).catch((err) => setError(err.message));
              }}
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {step === "review" && stats?.failed > 0 ? (
                <Button variant="secondary" onClick={handleRetryFailed} loading={generating}>
                  <RefreshCw className="h-4 w-4" />
                  Retry failed ({stats.failed})
                </Button>
              ) : null}
              {step === "review" && stats?.generated > 0 ? (
                <Button onClick={handleStartSending} loading={loading}>
                  <Send className="h-4 w-4" />
                  Start sending ({stats.generated} emails, {batch?.sends_per_hour ?? 100}/hour)
                </Button>
              ) : null}
              {step === "sending" && batch?.status !== "completed" ? (
                <Button variant="secondary" onClick={handleProcessNow} loading={loading}>
                  <RefreshCw className="h-4 w-4" />
                  Process queue now
                </Button>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function BudgetTierBadge({ budget }) {
  const tier = getBudgetTier(budget);
  const label = getBudgetTierLabel(tier);

  const styles = {
    simple: "bg-slate-100 text-(--body)",
    moderate: "bg-(--ink)/8 text-(--heading)",
    detailed: "bg-(--ink) text-(--on-ink)",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[tier]}`}
    >
      {label} email
    </span>
  );
}

function StatusPill({ status }) {
  const styles = {
    pending: "bg-slate-100 text-(--body)",
    generated: "bg-(--ink) text-(--on-ink)",
    queued: "bg-amber-50 text-amber-700",
    sent: "bg-green-50 text-green-700",
    failed: "bg-red-50 text-red-700",
    skipped: "bg-slate-100 text-(--muted-text)",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${styles[status] || styles.pending}`}
    >
      {status}
    </span>
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
