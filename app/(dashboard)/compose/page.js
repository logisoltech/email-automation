"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, Send, RotateCcw, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

function parseRecipients(value) {
  return value
    .split(/[,;\n]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function defaultScheduleValue() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function ComposeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional and friendly");
  const [audience, setAudience] = useState("business contacts");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [recipients, setRecipients] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduleValue);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : { templates: [] }))
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const templateId = searchParams.get("template");
    if (!templateId || !templates.length) return;

    const template = templates.find((item) => item.id === templateId);
    if (template) {
      applyTemplate(template);
    }
  }, [searchParams, templates]);

  function applyTemplate(template) {
    setSubject(template.subject);
    setBodyText(template.body_text);
    setBodyHtml(template.body_html || template.body_text);
    setSelectedTemplate(template.id);
    setSuccess(`Loaded template: ${template.name}`);
    setError("");
  }

  function handleTemplateSelect(event) {
    const id = event.target.value;
    setSelectedTemplate(id);

    if (!id) return;

    const template = templates.find((item) => item.id === id);
    if (template) applyTemplate(template);
  }

  async function handleGenerate() {
    setError("");
    setSuccess("");
    setGenerating(true);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, tone, audience }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to generate email.");
        return;
      }

      setSubject(data.subject);
      setBodyText(data.bodyText);
      setBodyHtml(data.bodyHtml);
      setSuccess("Email generated. Review and edit before sending.");
    } catch {
      setError("Something went wrong while generating.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    setError("");
    setSuccess("");

    const recipientList = parseRecipients(recipients);

    if (!recipientList.length) {
      setError("Add at least one recipient email.");
      return;
    }

    setSending(true);

    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          bodyText,
          bodyHtml,
          recipients: recipientList,
          aiPrompt: prompt || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to send email.");
        return;
      }

      setSuccess("Email sent successfully.");
      router.push("/history");
    } catch {
      setError("Something went wrong while sending.");
    } finally {
      setSending(false);
    }
  }

  async function handleSchedule() {
    setError("");
    setSuccess("");

    const recipientList = parseRecipients(recipients);

    if (!recipientList.length) {
      setError("Add at least one recipient email.");
      return;
    }

    if (!scheduledAt) {
      setError("Pick a schedule date and time.");
      return;
    }

    setScheduling(true);

    try {
      const response = await fetch("/api/emails/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          bodyText,
          bodyHtml,
          recipients: recipientList,
          scheduledAt: new Date(scheduledAt).toISOString(),
          aiPrompt: prompt || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to schedule email.");
        return;
      }

      setSuccess("Email scheduled successfully.");
      router.push("/history");
    } catch {
      setError("Something went wrong while scheduling.");
    } finally {
      setScheduling(false);
    }
  }

  function handleReset() {
    setPrompt("");
    setSubject("");
    setBodyText("");
    setBodyHtml("");
    setRecipients("");
    setSelectedTemplate("");
    setScheduledAt(defaultScheduleValue());
    setError("");
    setSuccess("");
  }

  return (
    <>
      {error ? <Alert variant="error">{error}</Alert> : null}

      {success ? <Alert variant="success">{success}</Alert> : null}

      <Card title="Load template" description="Start from a saved team template or generate with AI.">
        <div className="space-y-4">
          <div>
            <label htmlFor="template-select" className="mb-2 block text-sm font-medium text-(--body)">
              Template
            </label>
            <select
              id="template-select"
              value={selectedTemplate}
              onChange={handleTemplateSelect}
              className="flex h-11 w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 text-sm text-(--heading) shadow-[0_1px_0_var(--surface)_inset] transition focus:border-(--ink) focus:outline-none focus:ring-2 focus:ring-(--ink)/10"
            >
              <option value="">Choose a template (optional)</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-(--muted-text)">
              No templates yet.{" "}
              <Link
                href="/templates"
                className="font-medium text-(--heading) underline decoration-(--ink)/25 underline-offset-4 transition hover:decoration-(--ink)"
              >
                Create one
              </Link>
            </p>
          ) : null}
        </div>
      </Card>

      <Card title="AI prompt" description="Tell the AI what you want this email to accomplish.">
        <div className="space-y-4">
          <Textarea
            label="What should this email say?"
            placeholder="e.g. Follow up with a client about our proposal sent last week."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-35"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tone"
              value={tone}
              onChange={(event) => setTone(event.target.value)}
            />
            <Input
              label="Audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            />
          </div>
          <Button onClick={handleGenerate} loading={generating} disabled={prompt.trim().length < 10}>
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
        </div>
      </Card>

      <Card title="Email preview" description="Edit the subject and body before sending.">
        <div className="space-y-4">
          <Input
            label="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Email subject line"
          />
          <Textarea
            label="Body"
            value={bodyText}
            onChange={(event) => setBodyText(event.target.value)}
            className="min-h-55"
            placeholder="Email body will appear here after generation or template load"
          />
          <Input
            label="Recipients"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="client@example.com, partner@example.com"
          />
          <p className="text-xs text-(--muted-text)">Separate multiple emails with commas.</p>

          <Input
            label="Schedule for later"
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              onClick={handleSend}
              loading={sending}
              disabled={!subject || !bodyText || !recipients}
              className="sm:flex-1"
            >
              <Send className="h-4 w-4" />
              Send now
            </Button>
            <Button
              variant="secondary"
              onClick={handleSchedule}
              loading={scheduling}
              disabled={!subject || !bodyText || !recipients}
              className="sm:flex-1"
            >
              <Clock className="h-4 w-4" />
              Schedule
            </Button>
            <Button variant="secondary" onClick={handleReset} className="sm:w-auto">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Compose</h1>
        <p className="page-subtitle">
          Load a template, generate with AI, then send now or schedule for later.
        </p>
      </div>

      <Suspense
        fallback={
          <Card>
            <div className="flex items-center gap-2 text-sm text-(--muted-text)">
              <FileText className="h-4 w-4" />
              Loading compose...
            </div>
          </Card>
        }
      >
        <ComposeForm />
      </Suspense>
    </div>
  );
}
