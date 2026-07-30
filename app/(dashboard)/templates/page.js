"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";

const PAGE_SIZE = 10;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");

  async function loadTemplates() {
    const response = await fetch("/api/templates");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load templates.");
    }

    setTemplates(data.templates ?? []);
  }

  useEffect(() => {
    loadTemplates()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setName("");
    setSubject("");
    setBodyText("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(template) {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setBodyText(template.body_text);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const payload = { name, subject, bodyText };
      const response = await fetch(
        editingId ? `/api/templates/${editingId}` : "/api/templates",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to save template.");
        return;
      }

      setSuccess(editingId ? "Template updated." : "Template created.");
      resetForm();
      await loadTemplates();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this template?")) return;

    setError("");
    const response = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to delete template.");
      return;
    }

    setSuccess("Template deleted.");
    await loadTemplates();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">
            Shared email templates for your Logisol team.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setName("");
            setSubject("");
            setBodyText("");
          }}
        >
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {success ? <Alert variant="success">{success}</Alert> : null}

      {showForm ? (
        <Card
          title={editingId ? "Edit template" : "Create template"}
          description="Use {{name}} placeholders in the body if you like — replace manually in Compose."
        >
          <div className="space-y-4">
            <Input
              label="Template name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Client follow-up"
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
              className="min-h-50"
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSave} loading={saving} className="sm:flex-1">
                {editingId ? "Update template" : "Save template"}
              </Button>
              <Button variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-(--muted-text)">Loading templates...</p>
        </Card>
      ) : null}

      {!loading && templates.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="ps-streaks rounded-xl bg-(--ink) p-3 text-(--on-ink) shadow-[0_10px_24px_-14px_rgba(10,10,12,0.9)]">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-(--heading)">No templates yet</p>
            <p className="max-w-sm text-sm text-(--muted-text)">
              Save reusable emails your whole team can load in Compose.
            </p>
          </div>
        </Card>
      ) : null}

      {!loading && templates.length > 0 ? (
        <div className="space-y-3">
          {templates
            .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
            .map((template) => (
            <Card
              key={template.id}
              className="p-4 transition hover:border-(--ink)/25 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-(--heading)">{template.name}</h2>
                  <p className="mt-1 text-sm text-(--body)">{template.subject}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-(--muted-text)">{template.body_text}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/compose?template=${template.id}`}
                    className="ps-streaks inline-flex h-9 items-center gap-1 rounded-xl bg-(--ink) px-3 text-sm font-medium text-(--on-ink) shadow-[0_8px_20px_-14px_rgba(10,10,12,0.9)] transition hover:bg-[#22222a]"
                  >
                    Use
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => startEdit(template)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(templates.length / PAGE_SIZE))}
            total={templates.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
