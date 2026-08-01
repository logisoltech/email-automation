"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * @param {string | null | undefined} value
 */
function toDateInputValue(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return "";
}

/**
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   categories: Array<{ id: string; name: string }>;
 *   defaultCategoryId?: string;
 *   initialLead?: Record<string, unknown> | null;
 *   onSave: (payload: Record<string, string>) => Promise<void>;
 *   saving?: boolean;
 * }} props
 */
export function CreateLeadModal({
  open,
  onClose,
  categories,
  defaultCategoryId = "",
  initialLead = null,
  onSave,
  saving = false,
}) {
  const isEdit = Boolean(initialLead?.id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [budget, setBudget] = useState("");
  const [leadDate, setLeadDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [country, setCountry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialMediaLinks, setSocialMediaLinks] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) return;

    if (initialLead) {
      setName(String(initialLead.name || ""));
      setEmail(String((initialLead.emails || [])[0] || ""));
      setPhone(String(initialLead.phone || ""));
      setBudget(String(initialLead.budget || ""));
      setLeadDate(toDateInputValue(String(initialLead.lead_date || "")) || String(initialLead.lead_date || ""));
      setCategoryId(String(initialLead.category_id || defaultCategoryId || categories[0]?.id || ""));
      setServiceCategory(String(initialLead.category || ""));
      setCountry(String(initialLead.country || ""));
      setWebsiteUrl(String(initialLead.website_url || ""));
      setSocialMediaLinks(String(initialLead.social_media_links || ""));
      setDescription(String(initialLead.project_description || ""));
      setNotes(String(initialLead.notes || ""));
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setBudget("");
      setLeadDate(new Date().toISOString().slice(0, 10));
      setCategoryId(defaultCategoryId || categories[0]?.id || "");
      setServiceCategory("");
      setCountry("");
      setWebsiteUrl("");
      setSocialMediaLinks("");
      setDescription("");
      setNotes("");
    }
    setFormError("");
  }, [open, defaultCategoryId, categories, initialLead]);

  useEffect(() => {
    if (!open) return;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (!categoryId) {
      setFormError("Pick a subcategory.");
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        budget: budget.trim(),
        leadDate: leadDate.trim(),
        categoryId,
        category: serviceCategory.trim(),
        country: country.trim(),
        websiteUrl: websiteUrl.trim(),
        socialMediaLinks: socialMediaLinks.trim(),
        description: description.trim(),
        notes: notes.trim(),
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save lead.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-(--ink)/50 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,44rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-(--ink)/12 bg-(--surface) shadow-[0_24px_60px_-28px_rgba(10,10,12,0.55)]">
        <div className="flex shrink-0 items-start justify-between border-b border-(--ink)/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-(--heading)">
              {isEdit ? "Edit lead" : "Create lead"}
            </h2>
            <p className="mt-1 text-sm text-(--muted-text)">
              {isEdit
                ? "Update this contact and save changes."
                : "Add a contact manually to a subcategory."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-(--muted-text) transition hover:bg-(--ink)/6 hover:text-(--heading)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {formError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Cooper"
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                required
              />
              <Input
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 0100"
              />
              <Input
                label="Budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="$5,000"
              />
              <Input
                label="Date"
                type={/^\d{4}-\d{2}-\d{2}$/.test(leadDate) || !leadDate ? "date" : "text"}
                value={leadDate}
                onChange={(e) => setLeadDate(e.target.value)}
              />
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-(--heading)">Subcategory</span>
                <select
                  className="h-11 w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 text-sm text-(--heading) outline-none focus:border-(--ink)"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select subcategory
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Service"
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                placeholder="Web design, SMM, branding…"
              />
              <Input
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="United States"
              />
            </div>

            <Input
              label="Website link"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
            />
            <Textarea
              label="Social media links"
              value={socialMediaLinks}
              onChange={(e) => setSocialMediaLinks(e.target.value)}
              placeholder={"https://linkedin.com/in/…\nhttps://x.com/…"}
              className="min-h-24"
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Project or company description…"
              className="min-h-24"
            />
            <Textarea
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes…"
              className="min-h-24"
            />
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-(--ink)/10 px-5 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {isEdit ? "Save changes" : "Save lead"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
