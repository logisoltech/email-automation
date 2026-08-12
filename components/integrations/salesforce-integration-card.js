"use client";

import { useCallback, useEffect, useState } from "react";
import { CrmProviderTile } from "@/components/integrations/crm-provider-tile";
import { notify } from "@/lib/notify";

/**
 * @param {string} raw
 */
function formatSalesforceError(raw) {
  const text = decodeURIComponent(String(raw || "")).trim();
  const lower = text.toLowerCase();

  if (!text) {
    return {
      title: "Salesforce connection failed",
      description: "Something went wrong. Try connecting again.",
    };
  }

  if (lower.includes("invalid_client") || lower.includes("client id") || lower.includes("client_secret")) {
    return {
      title: "Salesforce credentials look wrong",
      description:
        "Check SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET in .env.local, then restart the app.",
    };
  }

  if (lower.includes("invalid_scope") || lower.includes("scope")) {
    return {
      title: "Salesforce needs more permissions",
      description:
        "In the Connected App, enable api, refresh_token, and offline_access, then reconnect.",
    };
  }

  if (lower.includes("redirect_uri") || lower.includes("redirect")) {
    return {
      title: "Salesforce redirect URI mismatch",
      description:
        "Set the callback to /api/integrations/salesforce/callback in both the Connected App and .env.local.",
    };
  }

  if (lower.includes("invalid_state") || lower.includes("workspace_mismatch")) {
    return {
      title: "Salesforce connect expired",
      description: "Start Connect Salesforce again from this workspace.",
    };
  }

  if (lower.includes("access_denied")) {
    return {
      title: "Salesforce access denied",
      description: "You declined the authorization request. Try Connect Salesforce again.",
    };
  }

  if (lower.includes("not_configured")) {
    return {
      title: "Salesforce isn’t configured",
      description: "Add Salesforce env vars on the server, then try again.",
    };
  }

  if (lower.includes("pkce") || lower.includes("code_verifier") || lower.includes("code_challenge")) {
    return {
      title: "Salesforce PKCE failed",
      description:
        "Start Connect Salesforce again from Integrations (don’t reuse an old auth tab).",
    };
  }

  const cleaned = text.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
  return {
    title: "Couldn't connect Salesforce",
    description: cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned || "Try connecting again.",
  };
}

/**
 * @param {{ isOwner: boolean }} props
 */
export function SalesforceIntegrationCard({ isOwner }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  /** @type {null | { status?: string; accountName?: string | null; hubId?: string | null; connectedAt?: string | null; lastSyncAt?: string | null; lastError?: string | null }} */
  const [integration, setIntegration] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/salesforce");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load Salesforce status.");
      setConfigured(Boolean(json.configured));
      setConnected(Boolean(json.connected));
      setIntegration(json.integration || null);
    } catch (err) {
      notify.error(
        "Couldn't load Salesforce",
        err instanceof Error ? err.message : "Try refreshing the page."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    if (params.get("salesforce") === "connected") {
      notify.success(
        "Salesforce connected",
        "You can import contacts from Leads and sync outreach status."
      );
      params.delete("salesforce");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
      load();
    }

    const err = params.get("salesforce_error");
    if (err) {
      const { title, description } = formatSalesforceError(err);
      notify.error(title, description, { duration: 7000 });
      params.delete("salesforce_error");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, [load]);

  async function handleDisconnect() {
    if (!confirm("Disconnect Salesforce from this workspace?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/salesforce", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Disconnect failed.");
      notify.success(
        "Salesforce disconnected",
        "This workspace is no longer linked to Salesforce."
      );
      await load();
    } catch (err) {
      notify.error(
        "Couldn't disconnect Salesforce",
        err instanceof Error ? err.message : "Try again in a moment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <CrmProviderTile
      name="Salesforce"
      logoSrc="/integrations/salesforce.svg"
      tagline="Import Contacts and push Bulkly outreach status back to Salesforce."
      features={["Contact import", "Send status", "Open tracking"]}
      loading={loading}
      busy={busy}
      configured={configured}
      connected={connected}
      accountName={integration?.accountName}
      lastSyncAt={integration?.lastSyncAt}
      lastError={integration?.lastError}
      isOwner={isOwner}
      onRefresh={load}
      onConnect={() => {
        window.location.href = "/api/integrations/salesforce/connect";
      }}
      onDisconnect={handleDisconnect}
      connectLabel="Connect Salesforce"
      className="[animation-delay:160ms]"
    />
  );
}
