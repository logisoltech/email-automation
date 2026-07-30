"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";

function parseRecipients(value) {
  return value
    .split(/[,;\n]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function defaultScheduleValue() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function StatusBadge({ status }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Sent
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

  if (status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <Clock className="h-3.5 w-3.5" />
        Scheduled
      </span>
    );
  }

  return (
    <span className="rounded-full bg-(--ink) px-2.5 py-1 text-xs font-medium text-(--on-ink)">
      {status}
    </span>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [recipients, setRecipients] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);

  async function loadCampaigns(requestedPage = page) {
    const response = await fetch(
      `/api/campaigns?page=${requestedPage}&pageSize=10`
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load campaigns.");
    }

    setCampaigns(data.campaigns ?? []);
    setPagination(
      data.pagination ?? {
        page: requestedPage,
        pageSize: 10,
        total: data.campaigns?.length ?? 0,
        totalPages: 1,
      }
    );
  }

  useEffect(() => {
    loadCampaigns()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(sendNow) {
    setError("");
    setSuccess("");
    setSubmitting(true);

    const recipientList = parseRecipients(recipients);

    if (!name || !subject || !bodyText || !recipientList.length) {
      setError("Fill in campaign name, subject, body, and at least one recipient.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        name,
        subject,
        bodyText,
        recipients: recipientList,
        sendNow,
      };

      if (!sendNow) {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
      }

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to save campaign.");
        return;
      }

      setSuccess(sendNow ? "Campaign sent to all recipients." : "Campaign scheduled.");
      setName("");
      setSubject("");
      setBodyText("");
      setRecipients("");
      setShowForm(false);
      setPage(1);
      await loadCampaigns(1);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">
            Send one email to a batch of recipients, now or on a schedule.
          </p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {success ? <Alert variant="success">{success}</Alert> : null}

      {showForm ? (
        <Card title="Create campaign" description="One message, multiple recipients.">
          <div className="space-y-4">
            <Input
              label="Campaign name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Q3 client outreach"
            />
            <Input
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
            <Textarea
              label="Body"
              value={bodyText}
              onChange={(event) => setBodyText(event.target.value)}
              className="min-h-45"
            />
            <Textarea
              label="Recipients"
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              placeholder="one@example.com, two@example.com"
              className="min-h-25"
            />
            <Input
              label="Schedule for later"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={() => handleSubmit(true)}
                loading={submitting}
                className="sm:flex-1"
              >
                <Send className="h-4 w-4" />
                Send now
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSubmit(false)}
                loading={submitting}
                className="sm:flex-1"
              >
                <Clock className="h-4 w-4" />
                Schedule
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-(--muted-text)">Loading campaigns...</p>
        </Card>
      ) : null}

      {!loading && campaigns.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="ps-streaks rounded-xl bg-(--ink) p-3 text-(--on-ink) shadow-[0_10px_24px_-14px_rgba(10,10,12,0.9)]">
              <Megaphone className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-(--heading)">No campaigns yet</p>
            <p className="max-w-sm text-sm text-(--muted-text)">
              Create a campaign to email multiple recipients at once.
            </p>
          </div>
        </Card>
      ) : null}

      {!loading && campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="p-4 transition hover:border-(--ink)/25 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-(--heading)">{campaign.name}</h2>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-2 text-sm text-(--body)">{campaign.subject}</p>
                  <p className="mt-1 text-sm text-(--muted-text)">
                    {campaign.recipients?.length ?? 0} recipients
                  </p>
                  {campaign.scheduled_at ? (
                    <p className="mt-1 text-xs text-amber-700">
                      Scheduled: {new Date(campaign.scheduled_at).toLocaleString()}
                    </p>
                  ) : null}
                  {campaign.error_message ? (
                    <p className="mt-2 text-sm text-red-600">{campaign.error_message}</p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            disabled={loading}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              setLoading(true);
              loadCampaigns(nextPage)
                .catch((err) => setError(err.message))
                .finally(() => setLoading(false));
            }}
          />
        </div>
      ) : null}

      <Card title="Tip" description="Generate copy in Compose, then paste it here for batch sends.">
        <Link
          href="/compose"
          className="text-sm font-medium text-(--heading) underline decoration-(--ink)/25 underline-offset-4 transition hover:decoration-(--ink)"
        >
          Open Compose →
        </Link>
      </Card>
    </div>
  );
}
