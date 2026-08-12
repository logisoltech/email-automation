"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Copy, Globe, Mail, Server } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { VerifyEmailToast } from "@/components/auth/verify-email-toast";

const OWNER_STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Sender" },
  { id: 3, label: "Delivery" },
];

function domainFromEmail(email) {
  return String(email || "").trim().toLowerCase().split("@")[1] || "";
}

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite") || "";
  const continueSetup = searchParams.get("setup") === "1";

  const [step, setStep] = useState(1);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitePreview, setInvitePreview] = useState(null);

  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [signatureText, setSignatureText] = useState("");

  /** @type {null | "own_smtp" | "platform"} */
  const [deliveryChoice, setDeliveryChoice] = useState(null);
  const [sendingDomain, setSendingDomain] = useState("");
  const [dnsRecords, setDnsRecords] = useState([]);
  const [domainStatus, setDomainStatus] = useState(null);
  const [domainVerified, setDomainVerified] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpTlsRejectUnauthorized, setSmtpTlsRejectUnauthorized] = useState(true);
  const [smtpTested, setSmtpTested] = useState(false);
  const [accountLocked, setAccountLocked] = useState(false);

  const isInvite = Boolean(inviteToken);

  const loginHref = inviteToken
    ? `/login?invite=${encodeURIComponent(inviteToken)}&next=/`
    : "/login";
  const verificationLoginHref = inviteToken
    ? loginHref
    : `/login?next=${encodeURIComponent("/signup?setup=1")}`;

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        if (inviteToken) {
          const inviteRes = await fetch(
            `/api/workspaces/invitations?token=${encodeURIComponent(inviteToken)}`
          );
          const inviteData = await inviteRes.json();
          if (!inviteRes.ok) throw new Error(inviteData.error || "Invalid invitation.");
          if (!cancelled) {
            setInvitePreview(inviteData.invitation);
            if (inviteData.invitation?.email) {
              setEmail(inviteData.invitation.email);
            }
          }
        }

        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const session = await sessionRes.json();
          if (!cancelled && session.authenticated) {
            if (!session.needsOnboarding) {
              router.replace("/");
              return;
            }
            // Resume incomplete owner setup inside this stepper
            setFullName(session.user?.email?.split("@")[0] || "");
            setWorkspaceName(session.workspace?.name || "");
            setFromName(session.settings?.fromName || "");
            setFromEmail(session.settings?.fromEmail || session.user?.email || "");
            setSignatureText(
              session.settings?.signatureText ||
                `Best Regards,\n${session.settings?.fromName || session.user?.email || "Team"}`
            );
            setSmtpHost(session.settings?.smtpHost || "");
            setSmtpPort(session.settings?.smtpPort || 587);
            setSmtpUser(session.settings?.smtpUser || "");
            setSmtpSecure(Boolean(session.settings?.smtpSecure));
            setSmtpTlsRejectUnauthorized(
              session.settings?.smtpTlsRejectUnauthorized !== false
            );
            setSmtpTested(Boolean(session.settings?.smtpLastTestedAt));
            setAccountLocked(true);
            if (session.settings?.sendingMode === "platform") {
              setDeliveryChoice("platform");
              setSendingDomain(session.settings?.sendingDomain || domainFromEmail(session.settings?.fromEmail || ""));
              setDomainVerified(Boolean(session.settings?.domainVerifiedAt));
              setStep(3);
              try {
                const domainRes = await fetch("/api/workspaces/domain");
                if (domainRes.ok) {
                  const domainJson = await domainRes.json();
                  if (!cancelled) {
                    setDnsRecords(domainJson.records || []);
                    setDomainStatus(domainJson.status || null);
                    if (domainJson.settings?.domainVerifiedAt) setDomainVerified(true);
                  }
                }
              } catch {
                // optional
              }
            } else if (session.settings?.smtpConfigured) {
              setDeliveryChoice("own_smtp");
              setStep(3);
            } else {
              setStep(session.settings?.fromEmail ? 3 : 2);
            }
          } else if (!cancelled && continueSetup) {
            router.replace("/login?next=/signup?setup=1");
            return;
          }
        } else if (!cancelled && continueSetup) {
          router.replace("/login?next=/signup?setup=1");
          return;
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, continueSetup, router]);

  async function createAccount(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          ...(inviteToken ? { inviteToken } : { workspaceName }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed.");

      if (data.needsEmailConfirmation) {
        toast.custom(
          (toastId) => (
            <VerifyEmailToast
              toastId={toastId}
              email={email}
              seconds={3}
              onDone={() => {
                toast.dismiss(toastId);
                router.push(verificationLoginHref);
              }}
            />
          ),
          {
            id: "verify-email",
            duration: Infinity,
            unstyled: true,
            className: "w-auto!",
          }
        );
        return;
      }

      if (data.joinedViaInvite || !data.needsOnboarding) {
        router.push("/");
        router.refresh();
        return;
      }

      setFromName(fullName);
      setFromEmail(email);
      setSignatureText(`Best Regards,\n${fullName}`);
      setSendingDomain(domainFromEmail(email));
      setAccountLocked(true);
      setStep(2);
      setSuccess("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSender(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName,
          fromName,
          fromEmail,
          signatureText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSendingDomain(domainFromEmail(fromEmail) || sendingDomain);
      setDeliveryChoice(null);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function chooseDelivery(mode) {
    setError("");
    setSuccess("");
    setDeliveryChoice(mode);
    if (mode === "platform") {
      setSendingDomain((d) => d || domainFromEmail(fromEmail));
      setDnsRecords([]);
      setDomainStatus(null);
      setDomainVerified(false);
    }
  }

  async function registerDomain() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: sendingDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDnsRecords(data.records || []);
      setDomainStatus(data.status || null);
      setDomainVerified(data.status === "verified" || Boolean(data.settings?.domainVerifiedAt));
      setSuccess(
        data.status === "verified"
          ? "Domain already verified."
          : "Add these DNS records at your domain registrar, then verify."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyDomain() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/domain/verify", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDnsRecords(data.records || dnsRecords);
      setDomainStatus(data.status || null);
      setDomainVerified(Boolean(data.verified));
      setSuccess(data.message || (data.verified ? "Domain verified." : "Not verified yet."));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function finishPlatformOnboarding() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendingMode: "platform",
          completeOnboarding: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  async function saveSmtp({ complete = false } = {}) {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sendingMode: "own_smtp",
          smtpHost,
          smtpPort: Number(smtpPort),
          smtpUser,
          smtpPass: smtpPass || undefined,
          smtpSecure,
          smtpTlsRejectUnauthorized,
          fromName,
          fromEmail,
          completeOnboarding: complete,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!complete) {
        setSmtpPass("");
        setSuccess("SMTP settings saved.");
        return true;
      }

      router.push("/");
      router.refresh();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function testSmtp() {
    setError("");
    setSuccess("");
    try {
      const saved = await saveSmtp({ complete: false });
      if (!saved) return;
      setLoading(true);
      const res = await fetch("/api/workspaces/settings/test-smtp", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSmtpTested(true);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const smtpUserIsEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser);
  const senderMismatch =
    smtpUserIsEmail && fromEmail.trim().toLowerCase() !== smtpUser.trim().toLowerCase();

  const brandTitle = isInvite
    ? "Join your team’s workspace."
    : step === 1
      ? "Start sending smarter outreach today."
      : step === 2
        ? "Tell us how you show up in the inbox."
        : "Choose how you’ll send email.";

  const brandDescription = isInvite
    ? "Create your account with the invited email. SMTP is already set up — you’ll land straight in the workspace."
    : step === 1
      ? "Create a workspace, connect delivery, and let AI draft personalized emails for every lead."
      : step === 2
        ? "Set your From name, address, and signature before choosing delivery."
        : "Use your own SMTP, or send through our servers after verifying your domain.";

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center ps-page">
        <p className="text-sm text-(--muted-text)">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen ps-page">
      <AuthBrandPanel
        title={brandTitle}
        description={brandDescription}
        footer={
          isInvite
            ? "Invited teammates skip delivery setup"
            : "Own SMTP or verified domain on our servers"
        }
      />

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className={`w-full space-y-8 ${step === 3 && deliveryChoice ? "max-w-lg" : "max-w-md"}`}>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-(--muted-text)">
              {isInvite
                ? "Join workspace"
                : `Step ${step} of ${OWNER_STEPS.length} · ${OWNER_STEPS[step - 1]?.label}`}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-(--heading)">
              {isInvite
                ? "Create your account"
                : step === 1
                  ? "Create your account"
                  : step === 2
                    ? "Sender identity"
                    : deliveryChoice === "own_smtp"
                      ? "Connect your SMTP"
                      : deliveryChoice === "platform"
                        ? "Verify your domain"
                        : "How will you send?"}
            </h2>
            {step === 1 ? (
              <p className="mt-2 text-sm font-light text-(--muted-text)">
                Already have an account?{" "}
                <Link
                  href={loginHref}
                  className="font-medium text-(--heading) underline decoration-(--ink)/25 underline-offset-4 hover:decoration-(--ink)"
                >
                  Sign in
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-sm font-light text-(--muted-text)">
                Finish setup to open your workspace dashboard.
              </p>
            )}
          </div>

          {!isInvite ? (
            <div className="flex gap-2">
              {OWNER_STEPS.map((item) => (
                <div
                  key={item.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    step >= item.id ? "bg-(--ink)" : "bg-(--ink)/10"
                  }`}
                />
              ))}
            </div>
          ) : null}

          {invitePreview && !invitePreview.expired ? (
            <Alert variant="info">
              Joining <strong>{invitePreview.workspaceName}</strong> as {invitePreview.role}.
              Use {invitePreview.email}.
            </Alert>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}

          {step === 1 ? (
            <form onSubmit={createAccount} className="space-y-4">
              <Input
                label="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Rivera"
                required
              />
              {!isInvite ? (
                <Input
                  label="Workspace name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Acme Outreach"
                  hint="Your company or team name"
                  required
                />
              ) : null}
              <Input
                label="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                disabled={Boolean(inviteToken && invitePreview?.email)}
                hint={
                  inviteToken
                    ? "Must match the email the invite was sent to"
                    : undefined
                }
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint="At least 8 characters"
                required
                minLength={8}
              />
              <Button type="submit" loading={loading} className="w-full">
                {isInvite ? "Create account & join" : "Continue"}
              </Button>
            </form>
          ) : null}

          {step === 2 ? (
            <form onSubmit={saveSender} className="space-y-4">
              <Input
                label="Workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
              />
              <Input
                label="From name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Alex Rivera"
                required
              />
              <Input
                label="From email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="alex@company.com"
                required
              />
              <Textarea
                label="Email signature"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                className="min-h-28"
              />
              <Button type="submit" loading={loading} className="w-full">
                Continue to delivery
              </Button>
              {!accountLocked ? (
                <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)}>
                  Back
                </Button>
              ) : null}
            </form>
          ) : null}

          {step === 3 && !deliveryChoice ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => chooseDelivery("own_smtp")}
                className="w-full rounded-2xl border border-(--ink)/12 bg-(--surface) p-5 text-left transition hover:border-(--ink)/30 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--ink) text-(--on-ink)">
                    <Server className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-(--heading)">Use your own server</p>
                    <p className="mt-1 text-sm font-light text-(--muted-text)">
                      Connect your SMTP host, mailbox, and password. Best if you already have
                      mail.yourdomain.com set up.
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => chooseDelivery("platform")}
                className="w-full rounded-2xl border border-(--ink)/12 bg-(--surface) p-5 text-left transition hover:border-(--ink)/30 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--ink) text-(--on-ink)">
                    <Globe className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-(--heading)">Use our server</p>
                    <p className="mt-1 text-sm font-light text-(--muted-text)">
                      Keep your From address (e.g. you@company.com). Add Amazon SES DNS records we
                      provide, verify the domain, then send through OutreachOS.
                    </p>
                  </div>
                </div>
              </button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(2)}>
                Back
              </Button>
            </div>
          ) : null}

          {step === 3 && deliveryChoice === "platform" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-(--ink) p-4 text-sm text-(--on-ink)/75">
                <Globe className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Add the DNS records at your registrar for{" "}
                  <strong className="text-(--on-ink)">{sendingDomain || "your domain"}</strong>.
                  Verification can take a few minutes after you save them.
                </p>
              </div>
              <Input
                label="Sending domain"
                value={sendingDomain}
                onChange={(e) => {
                  setSendingDomain(e.target.value);
                  setDomainVerified(false);
                  setDnsRecords([]);
                }}
                placeholder="company.com"
                hint="Usually the part after @ in your From email."
                required
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={registerDomain}
                  loading={loading}
                  className="sm:flex-1"
                >
                  Get DNS records
                </Button>
                <Button
                  type="button"
                  onClick={verifyDomain}
                  loading={loading}
                  disabled={!dnsRecords.length && !domainStatus}
                  className="sm:flex-1"
                >
                  Verify domain
                </Button>
              </div>

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
                        <tr key={`${row.type}-${row.name}-${index}`} className="border-t border-(--ink)/8">
                          <td className="px-3 py-2 align-top font-medium text-(--heading)">
                            {row.type}
                            {row.priority != null ? (
                              <span className="mt-0.5 block font-normal text-(--muted-text)">
                                prio {row.priority}
                              </span>
                            ) : null}
                          </td>
                          <td className="max-w-[8rem] break-all px-3 py-2 align-top text-(--body)">
                            {row.name}
                          </td>
                          <td className="max-w-[14rem] break-all px-3 py-2 align-top text-(--body)">
                            {row.value}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-(--muted-text) hover:bg-(--ink)/6 hover:text-(--heading)"
                              onClick={() => copyText(row.value)}
                              aria-label="Copy value"
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

              {domainStatus ? (
                <p className="text-center text-xs text-(--muted-text)">
                  Status: <strong className="text-(--heading)">{domainStatus}</strong>
                </p>
              ) : null}

              <Button
                type="button"
                onClick={finishPlatformOnboarding}
                loading={loading}
                disabled={!domainVerified}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finish
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setDeliveryChoice(null);
                  setError("");
                  setSuccess("");
                }}
              >
                Back to options
              </Button>
              {!domainVerified ? (
                <p className="text-center text-xs text-(--muted-text)">
                  Domain must verify before you can finish.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 3 && deliveryChoice === "own_smtp" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-(--ink) p-4 text-sm text-(--on-ink)/75">
                <Server className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Common setup: host <code className="text-(--on-ink)/90">mail.yourdomain.com</code>,
                  port <code className="text-(--on-ink)/90">587</code>, mailbox email + password.
                </p>
              </div>
              <Input
                label="SMTP host"
                value={smtpHost}
                onChange={(e) => {
                  setSmtpHost(e.target.value);
                  setSmtpTested(false);
                }}
                placeholder="mail.yourdomain.com"
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Port"
                  type="number"
                  value={smtpPort}
                  onChange={(e) => {
                    setSmtpPort(e.target.value);
                    setSmtpTested(false);
                  }}
                />
                <Input
                  label="SMTP username"
                  value={smtpUser}
                  onChange={(e) => {
                    setSmtpUser(e.target.value);
                    setSmtpTested(false);
                  }}
                  placeholder="you@yourdomain.com"
                />
              </div>
              <Input
                label="SMTP password"
                type="password"
                value={smtpPass}
                onChange={(e) => {
                  setSmtpPass(e.target.value);
                  setSmtpTested(false);
                }}
                hint="Leave blank only if already saved."
              />
              <Input
                label="From email"
                type="email"
                value={fromEmail}
                onChange={(e) => {
                  setFromEmail(e.target.value);
                  setSmtpTested(false);
                }}
                hint="Usually must match the SMTP username."
              />
              {senderMismatch ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <p className="font-medium">Sender address may be rejected</p>
                  <p className="mt-1">
                    SMTP user is <strong>{smtpUser}</strong>, but From is{" "}
                    <strong>{fromEmail}</strong>. Most hosts require them to match.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => {
                      setFromEmail(smtpUser);
                      setSmtpTested(false);
                    }}
                  >
                    Use {smtpUser} as From email
                  </Button>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-(--body)">
                <input
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => {
                    setSmtpSecure(e.target.checked);
                    setSmtpTested(false);
                  }}
                  className="accent-(--ink)"
                />
                Use SSL (port 465)
              </label>
              <label className="flex items-center gap-2 text-sm text-(--body)">
                <input
                  type="checkbox"
                  checked={!smtpTlsRejectUnauthorized}
                  onChange={(e) => {
                    setSmtpTlsRejectUnauthorized(!e.target.checked);
                    setSmtpTested(false);
                  }}
                  className="accent-(--ink)"
                />
                Allow mismatched TLS certificates
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={testSmtp}
                  loading={loading}
                  className="sm:flex-1"
                >
                  <Mail className="h-4 w-4" />
                  Save & test
                </Button>
                <Button
                  type="button"
                  onClick={() => saveSmtp({ complete: true })}
                  loading={loading}
                  disabled={!smtpTested}
                  className="sm:flex-1"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finish
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setDeliveryChoice(null);
                  setError("");
                  setSuccess("");
                }}
              >
                Back to options
              </Button>
              {!smtpTested ? (
                <p className="text-center text-xs text-(--muted-text)">
                  Send a successful test email before finishing.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
