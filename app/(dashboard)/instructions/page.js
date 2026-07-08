"use client";

import { useEffect, useState } from "react";
import { Sparkles, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [content, setContent] = useState("");

  async function loadInstructions() {
    const response = await fetch("/api/ai-instructions");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Failed to load instructions.");
    }

    setInstructions(data.instructions ?? []);
  }

  useEffect(() => {
    loadInstructions()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setContent("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(instruction) {
    setEditingId(instruction.id);
    setContent(instruction.content);
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function startCreate() {
    setEditingId(null);
    setContent("");
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  async function handleSave() {
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(
        editingId ? `/api/ai-instructions/${editingId}` : "/api/ai-instructions",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to save instruction.");
        return;
      }

      setSuccess(editingId ? "Instruction updated." : "Instruction added.");
      resetForm();
      await loadInstructions();
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this instruction?")) return;

    setError("");
    const response = await fetch(`/api/ai-instructions/${id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to delete instruction.");
      return;
    }

    setSuccess("Instruction deleted.");
    if (editingId === id) resetForm();
    await loadInstructions();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">AI Instructions</h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Set rules for how the AI writes emails — compose, campaigns, and lead imports all
            follow these.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add instruction
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {success}
        </div>
      ) : null}

      {showForm ? (
        <Card
          title={editingId ? "Edit instruction" : "New instruction"}
          description='Example: "From now on, write emails in a funny, lighthearted manner."'
        >
          <div className="space-y-4">
            <Textarea
              label="Instruction"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-[140px]"
              placeholder="Describe how the AI should write emails..."
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleSave} loading={saving} className="sm:flex-1">
                {editingId ? "Update instruction" : "Save instruction"}
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
          <p className="text-sm text-slate-500">Loading instructions...</p>
        </Card>
      ) : null}

      {!loading && instructions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-900">No instructions yet</p>
            <p className="max-w-md text-sm text-slate-500">
              Add instructions to control tone, style, or content. All active instructions are
              applied to every AI-generated email.
            </p>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Add your first instruction
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && instructions.length > 0 ? (
        <div className="space-y-3">
          <Card className="border-blue-100 bg-blue-50/50 p-4">
            <p className="text-sm text-blue-800">
              <span className="font-medium">{instructions.length} active instruction</span>
              {instructions.length === 1 ? "" : "s"} — applied to Compose, lead imports, and AI
              tests.
            </p>
          </Card>

          {instructions.map((instruction, index) => (
            <Card key={instruction.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Instruction {index + 1}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                    {instruction.content}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    Updated {formatDate(instruction.updated_at || instruction.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(instruction)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(instruction.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
