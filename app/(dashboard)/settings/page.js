"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Mail,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function StatusPill({ ok, label }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
          : "inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
      }
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load settings.");
        setData(json);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleTestSmtp() {
    setMessage("");
    setError("");
    setTestingSmtp(true);

    try {
      const res = await fetch("/api/settings/test-smtp", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(json.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setTestingSmtp(false);
    }
  }

  async function handleTestAi() {
    setMessage("");
    setError("");
    setTestingAi(true);

    try {
      const res = await fetch("/api/settings/test-ai", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(
        `AI OK (${json.provider}): "${json.subject}" — ${json.preview}...`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setTestingAi(false);
    }
  }

  async function handleProcessScheduled() {
    setMessage("");
    setError("");
    setProcessing(true);

    try {
      const res = await fetch("/api/settings/process-scheduled", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(json.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  const settings = data?.settings;
  const activeAi = settings?.ai?.[settings?.ai?.provider];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          View configuration status and test your integrations.
        </p>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading settings...</p>
        </Card>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </div>
      ) : null}

      {settings ? (
        <>
          <Card title="AI provider" description="Switch via AI_PROVIDER in .env.local">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-900">
                  Active: {settings.ai.provider}
                </span>
                <StatusPill
                  ok={Boolean(activeAi?.configured)}
                  label={activeAi?.configured ? "Configured" : "Missing API key"}
                />
              </div>
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">Gemini</p>
                  <p className="mt-1 text-xs">{settings.ai.gemini.model}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {settings.ai.gemini.configured
                      ? settings.ai.gemini.keyPreview
                      : "Not set"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">Groq</p>
                  <p className="mt-1 text-xs">{settings.ai.groq.model}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {settings.ai.groq.configured ? settings.ai.groq.keyPreview : "Not set"}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">OpenAI</p>
                  <p className="mt-1 text-xs">{settings.ai.openai.model}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {settings.ai.openai.configured
                      ? settings.ai.openai.keyPreview
                      : "Not set"}
                  </p>
                </div>
              </div>
              <Button onClick={handleTestAi} loading={testingAi} variant="secondary">
                <Sparkles className="h-4 w-4" />
                Test AI
              </Button>
            </div>
          </Card>

          <Card title="Email / SMTP" description="Configured in environment variables">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  ok={settings.smtp.configured}
                  label={settings.smtp.configured ? "Configured" : "Incomplete"}
                />
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Host</dt>
                  <dd className="font-medium text-slate-900">{settings.smtp.host || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Port</dt>
                  <dd className="font-medium text-slate-900">{settings.smtp.port}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">User</dt>
                  <dd className="font-medium text-slate-900">{settings.smtp.user || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">From</dt>
                  <dd className="font-medium text-slate-900">
                    {settings.smtp.fromName} &lt;{settings.smtp.fromEmail}&gt;
                  </dd>
                </div>
              </dl>
              <Button onClick={handleTestSmtp} loading={testingSmtp} variant="secondary">
                <Mail className="h-4 w-4" />
                Send test email to me
              </Button>
              <p className="text-xs text-slate-500">
                Sent mail is logged in the app under History (no inbox copies by default). To
                also BCC yourself, add SMTP_BCC_SELF=true to .env.local.
              </p>
            </div>
          </Card>

          <Card title="Access & scheduling">
            <div className="space-y-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900">Private team access</p>
                  <p className="mt-1">
                    Allowed domains:{" "}
                    {settings.access.allowedDomains.join(", ") || "none configured"}
                  </p>
                  <p className="mt-1 text-xs">
                    Signed in as {data?.user?.email}. Add users in Supabase → Authentication.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900">Scheduled sends</p>
                  <p className="mt-1">
                    CRON_SECRET:{" "}
                    {settings.scheduling.cronSecretConfigured ? "configured" : "not set"}
                  </p>
                  <p className="mt-1 text-xs">
                    Vercel cron runs every minute in production. Use the button below to
                    process due items manually during local dev.
                  </p>
                </div>
              </div>
              <Button onClick={handleProcessScheduled} loading={processing} variant="secondary">
                <RefreshCw className="h-4 w-4" />
                Process scheduled now
              </Button>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
