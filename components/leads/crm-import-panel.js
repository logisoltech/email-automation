"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { notify } from "@/lib/notify";

/**
 * Import CRM contacts into a lead subcategory.
 * @param {{
 *   provider: "hubspot" | "zoho" | "salesforce";
 *   label: string;
 *   open: boolean;
 *   categories: Array<{ id: string; name: string }>;
 *   defaultCategoryId: string;
 *   onImported: () => void | Promise<void>;
 *   onClose: () => void;
 * }} props
 */
export function CrmImportPanel({
  provider,
  label,
  open,
  categories,
  defaultCategoryId,
  onImported,
  onClose,
}) {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categoryId, setCategoryId] = useState(defaultCategoryId || "");
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (defaultCategoryId) setCategoryId(defaultCategoryId);
  }, [defaultCategoryId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function init() {
      setChecking(true);
      setError("");
      try {
        const res = await fetch(`/api/integrations/${provider}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Failed to check ${label}.`);
        if (cancelled) return;
        setConnected(Boolean(json.connected));
        if (json.connected) {
          setLoadingContacts(true);
          try {
            const listRes = await fetch(`/api/integrations/${provider}/import`);
            const listJson = await listRes.json();
            if (!listRes.ok) throw new Error(listJson.error || "Failed to list contacts.");
            if (!cancelled) {
              setContacts(listJson.contacts || []);
              setSelected(new Set());
            }
          } finally {
            if (!cancelled) setLoadingContacts(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Failed to check ${label}.`);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [open, provider, label]);

  async function loadContacts() {
    setLoadingContacts(true);
    setError("");
    try {
      const res = await fetch(`/api/integrations/${provider}/import`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to list contacts.");
      setContacts(json.contacts || []);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list contacts.");
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  }

  async function handleImport() {
    if (!categoryId || selected.size === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch(`/api/integrations/${provider}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          contactIds: [...selected],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed.");
      notify.success(
        `${label} import done`,
        `Imported ${json.imported}, skipped ${json.skipped}.`
      );
      await onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  return (
    <Card
      title={`Import from ${label}`}
      description={`Choose contacts from your connected ${label} account`}
    >
      <div className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        {checking ? (
          <p className="text-sm text-(--muted-text)">Checking {label}…</p>
        ) : !connected ? (
          <div className="space-y-3">
            <p className="text-sm text-(--body)">
              Connect {label} under Integrations first, then come back to import contacts.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = "/integrations";
              }}
            >
              Open Integrations
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-(--heading)">Subcategory</span>
                <select
                  className="h-11 w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 text-sm text-(--heading) outline-none focus:border-(--ink)"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={loadContacts} loading={loadingContacts}>
                Refresh contacts
              </Button>
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={!categoryId || selected.size === 0}
              >
                <Download className="h-4 w-4" />
                Import {selected.size || ""} selected
              </Button>
            </div>

            {loadingContacts ? (
              <p className="text-sm text-(--muted-text)">Loading contacts…</p>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-(--muted-text)">
                No {label} contacts with email found.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-(--ink)/10">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full border-separate border-spacing-0 text-left text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-(--surface-lo) text-xs uppercase tracking-wide text-(--muted-text)">
                        <th className="w-10 border-b border-(--ink)/10 bg-(--surface-lo) px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.size === contacts.length && contacts.length > 0}
                            onChange={toggleAll}
                            aria-label="Select all"
                          />
                        </th>
                        <th className="border-b border-(--ink)/10 bg-(--surface-lo) px-3 py-2.5">
                          Name
                        </th>
                        <th className="border-b border-(--ink)/10 bg-(--surface-lo) px-3 py-2.5">
                          Email
                        </th>
                        <th className="border-b border-(--ink)/10 bg-(--surface-lo) px-3 py-2.5">
                          Company
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => (
                        <tr key={c.id} className="border-t border-(--ink)/8">
                          <td className="border-b border-(--ink)/6 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggle(c.id)}
                              aria-label={`Select ${c.name}`}
                            />
                          </td>
                          <td className="border-b border-(--ink)/6 px-3 py-2.5 font-medium text-(--heading)">
                            {c.name}
                          </td>
                          <td className="border-b border-(--ink)/6 px-3 py-2.5 text-(--body)">
                            {c.email || "—"}
                          </td>
                          <td className="border-b border-(--ink)/6 px-3 py-2.5 text-(--body)">
                            {c.company || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
