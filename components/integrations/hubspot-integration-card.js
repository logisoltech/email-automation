"use client";

import { useCallback, useEffect, useState } from "react";
import { CrmProviderTile } from "@/components/integrations/crm-provider-tile";
import { notify } from "@/lib/notify";

/**
 * @param {string} raw
 */
function formatHubspotError(raw) {
  const text = decodeURIComponent(String(raw || "")).trim();
  const lower = text.toLowerCase();

  if (!text) {
    return {
      title: "HubSpot connection failed",
      description: "Something went wrong. Try connecting again.",
    };
  }

  if (lower.includes("missing or invalid client secret") || lower.includes("bad_client_secret")) {
    return {
      title: "HubSpot credentials look wrong",
      description: "Check HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in .env.local, then restart the app.",
    };
  }

  if (lower.includes("hasn't been granted all required scopes") || lower.includes("required scopes")) {
    return {
      title: "HubSpot needs more permissions",
      description:
        "Update the app scopes (contacts + contact schemas), run hs project upload, then reconnect.",
    };
  }

  if (lower.includes("invalid_state") || lower.includes("workspace_mismatch")) {
    return {
      title: "HubSpot connect expired",
      description: "Start Connect HubSpot again from this workspace.",
    };
  }

  if (lower.includes("unauthorized") || lower.includes("missing_code")) {
    return {
      title: "HubSpot authorization incomplete",
      description: "Stay signed in and try Connect HubSpot again.",
    };
  }

  if (lower.includes("not_configured")) {
    return {
      title: "HubSpot isn’t configured",
      description: "Add HubSpot env vars on the server, then try again.",
    };
  }

  const cleaned = text.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
  return {
    title: "Couldn't connect HubSpot",
    description: cleaned.length > 160 ? `${cleaned.slice(0, 157)}…` : cleaned || "Try connecting again.",
  };
}

/**
 * @param {{ isOwner: boolean }} props
 */
export function HubspotIntegrationCard({ isOwner }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  /** @type {null | { status?: string; accountName?: string | null; hubId?: string | null; connectedAt?: string | null; lastSyncAt?: string | null; lastError?: string | null }} */
  const [integration, setIntegration] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/hubspot");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load HubSpot status.");
      setConfigured(Boolean(json.configured));
      setConnected(Boolean(json.connected));
      setIntegration(json.integration || null);
    } catch (err) {
      notify.error(
        "Couldn't load HubSpot",
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

    if (params.get("hubspot") === "connected") {
      notify.success(
        "HubSpot connected",
        "You can import contacts from Leads and sync outreach status."
      );
      params.delete("hubspot");
      params.delete("integrations");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
      load();
    }

    const err = params.get("hubspot_error");
    if (err) {
      const { title, description } = formatHubspotError(err);
      notify.error(title, description, { duration: 7000 });
      params.delete("hubspot_error");
      params.delete("integrations");
      const next = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${next ? `?${next}` : ""}`);
    }
  }, [load]);

  async function handleDisconnect() {
    if (!confirm("Disconnect HubSpot from this workspace?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/hubspot", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Disconnect failed.");
      notify.success("HubSpot disconnected", "This workspace is no longer linked to HubSpot.");
      await load();
    } catch (err) {
      notify.error(
        "Couldn't disconnect HubSpot",
        err instanceof Error ? err.message : "Try again in a moment."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <CrmProviderTile
      name="HubSpot"
      logoSrc="/integrations/hubspot.svg"
      tagline="Pull contacts into Leads and push outreach status back into the CRM."
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
        window.location.href = "/api/integrations/hubspot/connect";
      }}
      onDisconnect={handleDisconnect}
      connectLabel="Connect HubSpot"
    />
  );
}
