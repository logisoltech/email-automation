"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Send, RotateCcw, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  RecipientField,
  parseRecipientEmails,
} from "@/components/compose/recipient-field";
import { fetchJson, queryKeys } from "@/lib/query";

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
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureImageUrl, setSignatureImageUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const templatesQuery = useQuery({
    queryKey: queryKeys.templates(),
    queryFn: () => fetchJson("/api/templates"),
    staleTime: 3 * 60_000,
  });
  const templates = templatesQuery.data?.templates ?? [];

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
    setLogoUrl(template.logo_url || "");
    setSignatureImageUrl(template.signature_image_url || "");
    setSelectedTemplate(template.id);
    setEditorKey((k) => k + 1);
    setSuccess(`Loaded template: ${template.name}`);
    setError("");
  }

  function handleTemplateSelect(event) {
    const id = event.target.value;
    setSelectedTemplate(id);

    if (!id) {
      setLogoUrl("");
      setSignatureImageUrl("");
      return;
    }

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
      setEditorKey((k) => k + 1);
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

    const recipientList = parseRecipientEmails(recipients);

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
          logoUrl: logoUrl || null,
          signatureImageUrl: signatureImageUrl || null,
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

    const recipientList = parseRecipientEmails(recipients);

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
          logoUrl: logoUrl || null,
          signatureImageUrl: signatureImageUrl || null,
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
    setLogoUrl("");
    setSignatureImageUrl("");
    setScheduledAt(defaultScheduleValue());
    setEditorKey((k) => k + 1);
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
          {logoUrl || signatureImageUrl ? (
            <div className="rounded-xl border border-(--ink)/10 bg-white p-4 text-sm text-slate-900">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Branding from template
              </p>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="mb-3 max-h-12 max-w-[160px] object-contain"
                />
              ) : null}
              {signatureImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signatureImageUrl}
                  alt="Signature"
                  className="max-h-20 max-w-[240px] object-contain"
                />
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Logo appears at the top; image signature replaces your workspace text signature.
              </p>
            </div>
          ) : null}
          <Input
            label="Subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Email subject line"
          />
          <RichTextEditor
            key={editorKey}
            label="Body"
            valueHtml={bodyHtml}
            valueText={bodyText}
            onChange={({ html, text }) => {
              setBodyHtml(html);
              setBodyText(text);
            }}
            placeholder="Email body will appear here after generation or template load"
          />
          <RecipientField value={recipients} onChange={setRecipients} />

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
        <h1 className="page-title">Personalized</h1>
        <p className="page-subtitle">
          Load a template, generate with AI, then send now or schedule for later.
        </p>
      </div>

      <Suspense
        fallback={
          <Card>
            <div className="flex items-center gap-2 text-sm text-(--muted-text)">
              <FileText className="h-4 w-4" />
              Loading personalized email...
            </div>
          </Card>
        }
      >
        <ComposeForm />
      </Suspense>
    </div>
  );
}
