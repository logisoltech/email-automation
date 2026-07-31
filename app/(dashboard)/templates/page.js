"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  ImagePlus,
  X,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Alert } from "@/components/ui/alert";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { fetchJson, queryKeys } from "@/lib/query";

const PAGE_SIZE = 10;

/**
 * @param {{
 *   label: string;
 *   hint: string;
 *   url: string;
 *   uploading: boolean;
 *   onUpload: (file: File) => void;
 *   onClear: () => void;
 * }} props
 */
function ImageField({ label, hint, url, uploading, onUpload, onClear }) {
  const inputRef = useRef(null);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-(--heading)">{label}</p>
      <p className="text-xs text-(--muted-text)">{hint}</p>
      {url ? (
        <div className="flex items-start gap-3 rounded-xl border border-(--ink)/10 bg-(--ink)/3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="max-h-20 max-w-[180px] rounded-lg object-contain bg-white"
          />
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-(--ink)/20 bg-(--surface) px-4 py-6 text-sm text-(--muted-text) transition hover:border-(--ink)/40 hover:text-(--heading)"
        >
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload image"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureImageUrl, setSignatureImageUrl] = useState("");

  const templatesQuery = useQuery({
    queryKey: queryKeys.templates(),
    queryFn: () => fetchJson("/api/templates"),
    staleTime: 3 * 60_000,
  });

  const templates = templatesQuery.data?.templates ?? [];
  const loading = templatesQuery.isLoading && !templatesQuery.data;

  function resetForm() {
    setName("");
    setSubject("");
    setBodyText("");
    setBodyHtml("");
    setLogoUrl("");
    setSignatureImageUrl("");
    setEditingId(null);
    setShowForm(false);
  }

  function openCreate() {
    setEditingId(null);
    setName("");
    setSubject("");
    setBodyText("");
    setBodyHtml("");
    setLogoUrl("");
    setSignatureImageUrl("");
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startEdit(template) {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setBodyText(template.body_text);
    setBodyHtml(template.body_html || "");
    setLogoUrl(template.logo_url || "");
    setSignatureImageUrl(template.signature_image_url || "");
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  /**
   * @param {File} file
   * @param {"logo" | "signature"} kind
   */
  async function uploadImage(file, kind) {
    setError("");
    if (kind === "logo") setUploadingLogo(true);
    else setUploadingSig(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/templates/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      if (kind === "logo") setLogoUrl(data.url);
      else setSignatureImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      if (kind === "logo") setUploadingLogo(false);
      else setUploadingSig(false);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const payload = {
        name,
        subject,
        bodyText,
        bodyHtml: bodyHtml || undefined,
        logoUrl: logoUrl || null,
        signatureImageUrl: signatureImageUrl || null,
      };
      await fetchJson(editingId ? `/api/templates/${editingId}` : "/api/templates", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setSuccess(editingId ? "Template updated." : "Template created.");
      resetForm();
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates() });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this template?")) return;

    setError("");
    try {
      await fetchJson(`/api/templates/${id}`, { method: "DELETE" });
      setSuccess("Template deleted.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.templates() });
    } catch (err) {
      setError(err.message || "Failed to delete template.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">
            Start from four built-in outreach templates, customize each one, or create your own.
            Add a company logo and image signature per template.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      {showForm ? (
        <Card
          title={editingId ? "Edit template" : "Create template"}
          description="Use {{name}} / {{company}} placeholders if you like — replace them in Personalized before sending."
        >
          <div className="space-y-5">
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
            <RichTextEditor
              key={editingId || "new"}
              label="Body"
              valueHtml={bodyHtml}
              valueText={bodyText}
              onChange={({ html, text }) => {
                setBodyHtml(html);
                setBodyText(text);
              }}
              placeholder="Write your email body… Use {{name}} if you like."
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <ImageField
                label="Company logo"
                hint="Shown at the top of the email. PNG or JPG, max 2MB."
                url={logoUrl}
                uploading={uploadingLogo}
                onUpload={(file) => uploadImage(file, "logo")}
                onClear={() => setLogoUrl("")}
              />
              <ImageField
                label="Signature image"
                hint="Replaces the workspace text signature for this template."
                url={signatureImageUrl}
                uploading={uploadingSig}
                onUpload={(file) => uploadImage(file, "signature")}
                onClear={() => setSignatureImageUrl("")}
              />
            </div>

            {(logoUrl || signatureImageUrl || bodyText) && (
              <div className="rounded-xl border border-(--ink)/10 bg-white p-4 text-sm text-slate-900">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Preview
                </p>
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo preview" className="mb-4 max-h-14 max-w-[160px] object-contain" />
                ) : null}
                <p className="mb-2 font-semibold">{subject || "Subject"}</p>
                {bodyHtml ? (
                  <div
                    className="text-sm leading-relaxed text-slate-700 [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {bodyText || "Body…"}
                  </div>
                )}
                {signatureImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={signatureImageUrl}
                    alt="Signature preview"
                    className="mt-4 max-h-24 max-w-[280px] object-contain"
                  />
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!name.trim() || !subject.trim() || !bodyText.trim()}
                className="sm:flex-1"
              >
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
              Create a template or refresh — starters seed automatically on first visit.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
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
                  <div className="flex min-w-0 flex-1 gap-4">
                    {template.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={template.logo_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg border border-(--ink)/10 object-contain bg-white"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-(--ink)/10 bg-(--ink)/4 text-(--muted-text)">
                        <FileText className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-(--heading)">
                          {template.name}
                        </h2>
                        {template.is_starter ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-(--ink)/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--heading)">
                            <Sparkles className="h-3 w-3" />
                            Starter
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-(--body)">{template.subject}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-(--muted-text)">
                        {template.body_text}
                      </p>
                      {template.signature_image_url ? (
                        <p className="mt-2 text-[11px] uppercase tracking-wide text-(--muted-text)">
                          Image signature attached
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/compose?template=${template.id}`}
                      className="ps-streaks inline-flex h-9 items-center gap-1 rounded-xl bg-(--ink) px-3 text-sm font-medium text-white! shadow-[0_8px_20px_-14px_rgba(10,10,12,0.9)] transition hover:bg-[#22222a] hover:text-white!"
                    >
                      Use
                      <ArrowRight className="h-3.5 w-3.5 text-white" />
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
