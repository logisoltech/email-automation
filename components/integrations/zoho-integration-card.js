"use client";

import { useCallback, useEffect, useState } from "react";
import { CrmProviderTile } from "@/components/integrations/crm-provider-tile";
import { notify } from "@/lib/notify";

/**
 * @param {string} raw
 */
function formatZohoError(raw) {
  const text = decodeURIComponent(String(raw || "")).trim();
  const lower = text.toLowerCase();

  if (!text) {
    return {
      title: "Zoho connection failed",
      description: "Something went wrong. Try connecting again.",
    };
  }

  if (lower.includes("invalid_client") || lower.includes("client secret")) {
    return {
      title: "Zoho credentials look wrong",
      description: "Check ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET in .env.local, then restart the app.",
    };
  }

  if (lower.includes("invalid_scope") || lower.includes("scope")) {
    return {
      title: "Zoho needs more permissions",
      description:
        "In Zoho API Console, enable Contacts read/write and Settings fields scopes, then reconnect.",
    };
  }

  if (lower.includes("invalid_redirect") || lower.includes("redirect_uri")) {
    return {
      title: "Zoho redirect URI mismatch",
      description:
        "Set the redirect URI to /api/integrations/zoho/callback in both Zoho Console and .env.local.",
    };
  }

  if (lower.includes("invalid_state") || lower.includes("workspace_mismatch")) {
    return {
      title: "Zoho connect expired",
      description: "Start Connect Zoho again from this workspace.",
    };
  }

  if (lower.includes("access_denied")) {
    return {
      title: "Zoho access denied",
      description: "You declined the authorization request. Try Connect Zoho again.",
    };
  }

  if (lower.includes("not_configured")) {
    return {
      title: "Zoho isn’t configured",
      description: "Add Zoho env vars on the server, then try again.",
    };
  }

  const cleaned = text.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
  return {
    title: "Couldn't connect Zoho",
    description: cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned || "Try connecting again.",
  };
}

/**
 * @param {{ isOwner: boolean }} props
 */
export function ZohoIntegrationCard({ isOwner }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  /** @type {null | { status?: string; accountName?: string | null; hubId?: string | null; connectedAt?: string | null; lastSyncAt?: string | null; lastError?: string | null }} */
  const [integration, setIntegration] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/zoho");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load Zoho status.");
      setConfigured(Boolean(json.configured));
      setConnected(Boolean(json.connected));
      setIntegration(json.integration || null);
    } catch (err) {
      notify.error(
        "Couldn't load Zoho",
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

    if (params.get("zoho") === "connected") {
      notify.success(
        "Zoho connected",
        "You can import contacts from Leads and sync outreach status."
      );
      params.delete("zoho");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
      load();
    }

    const err = params.get("zoho_error");
    if (err) {
      const { title, description } = formatZohoError(err);
      notify.error(title, description, { duration: 7000 });
      params.delete("zoho_error");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, [load]);

  async function handleDisconnect() {
    if (!confirm("Disconnect Zoho from this workspace?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/zoho", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Disconnect failed.");
      notify.success("Zoho disconnected", "This workspace is no longer linked to Zoho CRM.");
      await load();
    } catch (err) {
      notify.error(
        "Couldn't disconnect Zoho",
        err instanceof Error ? err.message : "Try again in a moment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <CrmProviderTile
      name="Zoho CRM"
      logoSrc="/integrations/zoho.svg"
      tagline="Sync Zoho contacts the same way — import in, outreach status out."
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
        window.location.href = "/api/integrations/zoho/connect";
      }}
      onDisconnect={handleDisconnect}
      connectLabel="Connect Zoho"
      className="[animation-delay:80ms]"
    />
  );
}
