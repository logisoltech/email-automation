"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Send, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

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
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
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

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [recipients, setRecipients] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);

  async function loadCampaigns() {
    const response = await fetch("/api/campaigns");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load campaigns.");
    }

    setCampaigns(data.campaigns ?? []);
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
      await loadCampaigns();
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
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Campaigns</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Send one email to a batch of recipients, now or on a schedule.
          </p>
        </div>
        <Button onClick={() => setShowForm((value) => !value)}>
          <Plus className="h-4 w-4" />
          New campaign
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {success}
        </div>
      ) : null}

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
              className="min-h-[180px]"
            />
            <Textarea
              label="Recipients"
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              placeholder="one@example.com, two@example.com"
              className="min-h-[100px]"
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
          <p className="text-sm text-slate-500">Loading campaigns...</p>
        </Card>
      ) : null}

      {!loading && campaigns.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Megaphone className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-900">No campaigns yet</p>
            <p className="max-w-sm text-sm text-slate-500">
              Create a campaign to email multiple recipients at once.
            </p>
          </div>
        </Card>
      ) : null}

      {!loading && campaigns.length > 0 ? (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{campaign.name}</h2>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{campaign.subject}</p>
                  <p className="mt-1 text-sm text-slate-500">
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
        </div>
      ) : null}

      <Card title="Tip" description="Generate copy in Compose, then paste it here for batch sends.">
        <Link href="/compose" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          Open Compose →
        </Link>
      </Card>
    </div>
  );
}
