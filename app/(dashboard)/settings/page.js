"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Users,
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { ImageField } from "@/components/ui/image-field";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { toast } from "sonner";

function StatusPill({ ok, label }) {
  return (
    <span
      className={
        ok
          ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
          : "inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
      }
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function domainFromEmail(email) {
  return String(email || "").trim().toLowerCase().split("@")[1] || "";
}

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [team, setTeam] = useState({ members: [], invitations: [], isOwner: false });
  const [isOwner, setIsOwner] = useState(false);

  const [workspaceName, setWorkspaceName] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [signatureImageUrl, setSignatureImageUrl] = useState("");
  const [uploadingSignature, setUploadingSignature] = useState(false);
  /** @type {null | "own_smtp" | "platform"} */
  const [sendingMode, setSendingMode] = useState(null);
  const [sendingDomain, setSendingDomain] = useState("");
  const [domainVerifiedAt, setDomainVerifiedAt] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [domainStatus, setDomainStatus] = useState(null);
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpTlsRejectUnauthorized, setSmtpTlsRejectUnauthorized] = useState(true);
  const [sendsPerHour, setSendsPerHour] = useState(100);
  const [smtpLastTestedAt, setSmtpLastTestedAt] = useState(null);

  async function loadAll() {
    const [settingsRes, teamRes, sessionRes] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/workspaces/invitations"),
      fetch("/api/workspaces/settings"),
    ]);

    const settingsJson = await settingsRes.json();
    if (!settingsRes.ok) throw new Error(settingsJson.error);

    const wsJson = await sessionRes.json();
    if (sessionRes.ok) {
      const s = wsJson.settings || {};
      setWorkspaceName(wsJson.workspace?.name || "");
      setFromName(s.fromName || "");
      setFromEmail(s.fromEmail || "");
      setSignatureText(s.signatureText || "");
      setSignatureImageUrl(s.signatureImageUrl || "");
      setSendingMode(s.sendingMode || (s.smtpConfigured ? "own_smtp" : null));
      setSendingDomain(s.sendingDomain || domainFromEmail(s.fromEmail || ""));
      setDomainVerifiedAt(s.domainVerifiedAt || null);
      setSmtpHost(s.smtpHost || "");
      setSmtpPort(s.smtpPort || 587);
      setSmtpUser(s.smtpUser || "");
      setSmtpSecure(Boolean(s.smtpSecure));
      setSmtpTlsRejectUnauthorized(s.smtpTlsRejectUnauthorized !== false);
      setSmtpLastTestedAt(s.smtpLastTestedAt || null);
      setSendsPerHour(wsJson.workspace?.sends_per_hour ?? 100);

      if (s.sendingMode === "platform" || s.sesIdentity || s.sendingDomain) {
        try {
          const domainRes = await fetch("/api/workspaces/domain");
          if (domainRes.ok) {
            const domainJson = await domainRes.json();
            setDnsRecords(domainJson.records || []);
            setDomainStatus(domainJson.status || null);
            if (domainJson.settings?.domainVerifiedAt) {
              setDomainVerifiedAt(domainJson.settings.domainVerifiedAt);
            }
            if (domainJson.domain) setSendingDomain(domainJson.domain);
          }
        } catch {
          // optional
        }
      }
    }

    if (teamRes.ok) {
      const teamJson = await teamRes.json();
      setTeam(teamJson);
      setIsOwner(Boolean(teamJson.isOwner));
    } else if (wsJson.workspace?.role) {
      setIsOwner(wsJson.workspace.role === "owner");
    } else {
      const authRes = await fetch("/api/auth/session");
      if (authRes.ok) {
        const authJson = await authRes.json();
        setIsOwner(authJson.workspace?.role === "owner");
      }
    }

    setData(settingsJson);
  }

  useEffect(() => {
    loadAll()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (typeof window === "undefined") return;
    if (window.location.hash === "#team") {
      document.getElementById("team")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  async function saveSettings(extra = {}) {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName,
          fromName,
          fromEmail,
          signatureText,
          signatureImageUrl: signatureImageUrl || null,
          sendingMode: sendingMode || undefined,
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPass: smtpPass || undefined,
          smtpSecure,
          smtpTlsRejectUnauthorized,
          ...extra,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage("Settings saved.");
      setSmtpPass("");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSmtp() {
    setMessage("");
    setError("");
    setSaving(true);
    try {
      await saveSettings();
      const res = await fetch("/api/workspaces/settings/test-smtp", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(json.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite() {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: "member" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setInviteUrl(`${window.location.origin}${json.inviteUrl}`);
      setInviteEmail("");
      setMessage("Invitation created. Share the link with your teammate.");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadSignatureImage(file) {
    setError("");
    setMessage("");
    setUploadingSignature(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/templates/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed.");
      setSignatureImageUrl(json.url || "");
      setMessage("Signature image uploaded. Click Save identity to keep it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadingSignature(false);
    }
  }

  async function switchSendingMode(mode) {
    setError("");
    setMessage("");
    setSendingMode(mode);
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendingMode: mode }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMessage(mode === "platform" ? "Switched to platform delivery." : "Switched to own SMTP.");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function registerDomain() {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: sendingDomain.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDnsRecords(json.records || []);
      setDomainStatus(json.status || null);
      setDomainVerifiedAt(json.settings?.domainVerifiedAt || null);
      setSendingMode("platform");
      setMessage(
        json.status === "verified"
          ? "Domain already verified."
          : "Add these DNS records, then click Verify domain."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function verifyDomain() {
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces/domain/verify", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDnsRecords(json.records || dnsRecords);
      setDomainStatus(json.status || null);
      setDomainVerifiedAt(json.settings?.domainVerifiedAt || null);
      setMessage(json.message || "");
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  const settings = data?.settings;
  const smtpUserIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser);
  const senderMismatch =
    smtpUserIsEmail &&
    fromEmail.trim().toLowerCase() !== smtpUser.trim().toLowerCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Manage workspace identity, email delivery, team access, and AI status.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      {loading ? (
        <Card>
          <p className="text-sm text-(--muted-text)">Loading settings...</p>
        </Card>
      ) : null}

      {!loading && settings ? (
        <>
          {isOwner ? (
            <Card title="Workspace & sender" description="How your emails appear to recipients">
              <div className="space-y-4">
                <Input
                  label="Workspace name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="From name"
                    value={fromName}
                    onChange={(e) => setFromName(e.target.value)}
                  />
                  <Input
                    label="From email"
                    type="email"
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                  />
                </div>
                <Textarea
                  label="Signature"
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  hint="Used when no image signature is set (and when a template doesn't override)."
                />
                <ImageField
                  label="Signature image"
                  hint="Optional. Shown at the bottom of emails instead of the text signature. Templates can still override this."
                  url={signatureImageUrl}
                  uploading={uploadingSignature}
                  onUpload={uploadSignatureImage}
                  onClear={() => setSignatureImageUrl("")}
                />
                <Button onClick={() => saveSettings()} loading={saving}>
                  Save identity
                </Button>
              </div>
            </Card>
          ) : (
            <Card title="Workspace & sender" description="Managed by the workspace owner">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-4 border-b border-(--ink)/8 pb-3">
                  <span className="text-(--muted-text)">Workspace</span>
                  <span className="font-medium text-(--heading)">{workspaceName || "—"}</span>
                </div>
                <div className="flex justify-between gap-4 border-b border-(--ink)/8 pb-3">
                  <span className="text-(--muted-text)">From</span>
                  <span className="font-medium text-(--heading)">
                    {fromName ? `${fromName} <${fromEmail || "—"}>` : fromEmail || "—"}
                  </span>
                </div>
                {signatureImageUrl ? (
                  <div className="space-y-2 border-b border-(--ink)/8 pb-3">
                    <span className="text-(--muted-text)">Signature image</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={signatureImageUrl}
                      alt="Signature"
                      className="max-h-16 max-w-[200px] rounded-lg bg-white object-contain"
                    />
                  </div>
                ) : null}
                <p className="text-xs font-light text-(--muted-text)">
                  Only the owner can change sender identity and signature.
                </p>
              </div>
            </Card>
          )}

          {isOwner ? (
            <Card
              title="Email delivery"
              description="Send with your SMTP, or through OutreachOS after domain verification"
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <StatusPill
                  ok={
                    sendingMode === "platform"
                      ? Boolean(domainVerifiedAt)
                      : Boolean(settings.smtp.configured)
                  }
                  label={
                    sendingMode === "platform"
                      ? domainVerifiedAt
                        ? "Domain verified"
                        : "Domain pending"
                      : settings.smtp.configured
                        ? "SMTP configured"
                        : "Not configured"
                  }
                />
                <span className="inline-flex items-center rounded-full bg-(--ink)/5 px-2.5 py-1 text-xs font-medium text-(--heading)">
                  Up to {sendsPerHour}/hour
                </span>
              </div>

              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => switchSendingMode("own_smtp")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    sendingMode === "own_smtp"
                      ? "border-(--ink) bg-(--ink)/4"
                      : "border-(--ink)/12 hover:border-(--ink)/30"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-(--heading)">
                    <Server className="h-4 w-4" />
                    Your own server
                  </p>
                  <p className="mt-1 text-xs text-(--muted-text)">
                    SMTP host, mailbox, and password you control.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => switchSendingMode("platform")}
                  className={`rounded-2xl border p-4 text-left transition ${
                    sendingMode === "platform"
                      ? "border-(--ink) bg-(--ink)/4"
                      : "border-(--ink)/12 hover:border-(--ink)/30"
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-(--heading)">
                    <Globe className="h-4 w-4" />
                    Our server
                  </p>
                  <p className="mt-1 text-xs text-(--muted-text)">
                    Verify your domain with Amazon SES DNS, send as your From address.
                  </p>
                </button>
              </div>

              {sendingMode === "platform" ? (
                <div className="space-y-4">
                  <Input
                    label="Sending domain"
                    value={sendingDomain}
                    onChange={(e) => setSendingDomain(e.target.value)}
                    placeholder="company.com"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={registerDomain} loading={saving}>
                      Get DNS records
                    </Button>
                    <Button onClick={verifyDomain} loading={saving}>
                      Verify domain
                    </Button>
                  </div>
                  {domainStatus ? (
                    <p className="text-xs text-(--muted-text)">
                      Status: <strong className="text-(--heading)">{domainStatus}</strong>
                      {domainVerifiedAt
                        ? ` · Verified ${new Date(domainVerifiedAt).toLocaleString()}`
                        : null}
                    </p>
                  ) : null}
                  {dnsRecords.length ? (
                    <div className="overflow-x-auto rounded-xl border border-(--ink)/10">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-(--ink)/4 text-(--muted-text)">
                          <tr>
                            <th className="px-3 py-2 font-medium">Type</th>
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Value</th>
                            <th className="px-3 py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {dnsRecords.map((row, index) => (
                            <tr
                              key={`${row.type}-${row.name}-${index}`}
                              className="border-t border-(--ink)/8"
                            >
                              <td className="px-3 py-2 align-top font-medium text-(--heading)">
                                {row.type}
                              </td>
                              <td className="max-w-[8rem] break-all px-3 py-2 align-top">
                                {row.name}
                              </td>
                              <td className="max-w-[16rem] break-all px-3 py-2 align-top">
                                {row.value}
                              </td>
                              <td className="px-2 py-2 align-top">
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-(--muted-text) hover:bg-(--ink)/6"
                                  onClick={() => copyText(row.value)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <Input
                    label="SMTP host"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="mail.yourdomain.com"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Port"
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                    <Input
                      label="Username"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Password"
                    type="password"
                    value={smtpPass}
                    onChange={(e) => setSmtpPass(e.target.value)}
                    hint="Leave blank to keep the existing password."
                  />
                  {senderMismatch ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-medium">From email and SMTP mailbox do not match</p>
                      <p className="mt-1">
                        Your server may reject mail sent From <strong>{fromEmail}</strong> while
                        authenticated as <strong>{smtpUser}</strong>.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => setFromEmail(smtpUser)}
                      >
                        Use {smtpUser} as From email
                      </Button>
                    </div>
                  ) : null}
                  <label className="flex items-center gap-2 text-sm text-(--body)">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="accent-(--ink)"
                    />
                    Use SSL (port 465)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-(--body)">
                    <input
                      type="checkbox"
                      checked={!smtpTlsRejectUnauthorized}
                      onChange={(e) => setSmtpTlsRejectUnauthorized(!e.target.checked)}
                      className="accent-(--ink)"
                    />
                    Allow mismatched TLS certificates
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={() => saveSettings({ sendingMode: "own_smtp" })}
                      loading={saving}
                      variant="secondary"
                    >
                      <Server className="h-4 w-4" />
                      Save SMTP
                    </Button>
                    <Button onClick={handleTestSmtp} loading={saving}>
                      <Mail className="h-4 w-4" />
                      Send test email
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card title="Email delivery" description="Managed by the workspace owner">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    ok={
                      sendingMode === "platform"
                        ? Boolean(domainVerifiedAt)
                        : Boolean(settings.smtp.configured)
                    }
                    label={
                      sendingMode === "platform"
                        ? domainVerifiedAt
                          ? "Domain verified"
                          : "Domain pending"
                        : settings.smtp.configured
                          ? "SMTP configured"
                          : "Not configured"
                    }
                  />
                  <span className="inline-flex items-center rounded-full bg-(--ink)/5 px-2.5 py-1 text-xs font-medium text-(--heading)">
                    Up to {sendsPerHour}/hour
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4 border-b border-(--ink)/8 pb-3">
                    <span className="text-(--muted-text)">Mode</span>
                    <span className="font-medium text-(--heading)">
                      {sendingMode === "platform" ? "Our server" : "Own SMTP"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-(--ink)/8 pb-3">
                    <span className="text-(--muted-text)">From address</span>
                    <span className="font-medium text-(--heading)">{fromEmail || "—"}</span>
                  </div>
                  {sendingMode === "platform" ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-(--muted-text)">Domain</span>
                      <span className="font-medium text-(--heading)">{sendingDomain || "—"}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-4">
                      <span className="text-(--muted-text)">Last tested</span>
                      <span className="font-medium text-(--heading)">
                        {smtpLastTestedAt
                          ? new Date(smtpLastTestedAt).toLocaleString()
                          : "Not tested yet"}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-xs font-light text-(--muted-text)">
                  Only the owner can change delivery settings.
                </p>
              </div>
            </Card>
          )}

          <Card
            id="team"
            title="Team"
            description={
              isOwner
                ? "Invite teammates to this workspace"
                : "People with access to this workspace"
            }
          >
            <div className="space-y-4">
              {isOwner ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="flex-1">
                      <Input
                        label="Invite email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@company.com"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleInvite} loading={saving}>
                        <Users className="h-4 w-4" />
                        Invite
                      </Button>
                    </div>
                  </div>
                  {inviteUrl ? (
                    <div className="rounded-xl border border-(--ink)/10 bg-(--ink)/2.5 p-3 text-sm shadow-[0_1px_0_var(--surface)_inset]">
                      <p className="mb-1 font-medium text-(--body)">Invite link</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate text-xs text-(--body)">
                          {inviteUrl}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigator.clipboard.writeText(inviteUrl)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {(team.invitations || []).filter((i) => i.status === "pending").length >
                  0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-(--muted-text)">
                        Pending invites
                      </p>
                      {(team.invitations || [])
                        .filter((i) => i.status === "pending")
                        .map((invite) => (
                          <div
                            key={invite.id}
                            className="flex items-center justify-between rounded-lg border border-(--ink)/10 px-3 py-2 text-sm transition hover:border-(--ink)/25"
                          >
                            <span className="text-(--body)">{invite.email}</span>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                              pending
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-(--muted-text)">
                  Only the workspace owner can invite new teammates.
                </p>
              )}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-(--muted-text)">
                  Members ({team.members?.length || 0})
                </p>
                {(team.members || []).length === 0 ? (
                  <p className="text-sm text-(--muted-text)">No members found.</p>
                ) : null}
                {(team.members || []).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-(--ink)/10 px-3 py-2 text-sm transition hover:border-(--ink)/25"
                  >
                    <span className="text-(--body)">
                      {member.email || member.userId || member.user_id}
                    </span>
                    <span className="rounded-full bg-(--ink) px-2 py-0.5 text-xs capitalize text-(--on-ink)">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Queue" description="Manually process scheduled items for this workspace">
            <Button
              variant="secondary"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                setError("");
                try {
                  const res = await fetch("/api/settings/process-scheduled", {
                    method: "POST",
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error);
                  setMessage(json.message || "Processed queue.");
                } catch (err) {
                  setError(err.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Process scheduled now
            </Button>
          </Card>
        </>
      ) : null}

      <AppearanceCard />
    </div>
  );
}
