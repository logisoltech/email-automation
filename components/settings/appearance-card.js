"use client";

import { useEffect, useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DEFAULT_THEME,
  THEME_FIELDS,
  THEME_PRESETS,
  applyTheme,
  isDefaultTheme,
  isHexColor,
  readStoredTheme,
  storeTheme,
} from "@/lib/theme";
import { notify } from "@/lib/notify";

function ColorRow({ field, value, onChange }) {
  // Kept separate from `value` so a partially typed hex like "#0a0" doesn't
  // snap the swatch back to the last valid colour on every keystroke.
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commitDraft(next) {
    const trimmed = next.startsWith("#") ? next : `#${next}`;
    setDraft(trimmed);
    if (isHexColor(trimmed)) onChange(trimmed.toLowerCase());
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-(--ink)/10 px-3 py-2.5 transition hover:border-(--ink)/25">
      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-(--ink)/15">
        <span className="absolute inset-0" style={{ background: value }} />
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={field.label}
        />
      </label>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-(--heading)">{field.label}</p>
        <p className="truncate text-xs font-light text-(--muted-text)">{field.description}</p>
      </div>

      <input
        type="text"
        value={draft}
        spellCheck={false}
        onChange={(event) => commitDraft(event.target.value)}
        onBlur={() => setDraft(value)}
        className="h-9 w-24 rounded-lg border border-(--ink)/12 bg-(--surface) px-2.5 text-center font-mono text-xs uppercase text-(--heading) outline-none transition focus:border-(--ink)"
      />
    </div>
  );
}

export function AppearanceCard() {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  // The inline script in <head> already painted the saved palette; this only
  // syncs the editor's own inputs once the component mounts.
  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  function update(patch) {
    setTheme((current) => {
      const next = { ...current, ...patch };
      applyTheme(next);
      storeTheme(next);
      return next;
    });
  }

  function reset() {
    setTheme(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    storeTheme(DEFAULT_THEME);
    notify.success("Back to Printstream", "The default palette has been restored.");
  }

  const atDefault = isDefaultTheme(theme);

  return (
    <Card
      title="Appearance"
      description="Recolour the interface. Saved to this browser, so it won't change what your teammates see."
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-(--muted-text)">
            Presets
          </p>
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => {
              const active = THEME_FIELDS.every(
                (field) => theme[field.key] === preset.theme[field.key]
              );

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => update(preset.theme)}
                  className={
                    active
                      ? "inline-flex items-center gap-2 rounded-xl border border-(--ink) px-3 py-2 text-sm font-medium text-(--heading)"
                      : "inline-flex items-center gap-2 rounded-xl border border-(--ink)/12 px-3 py-2 text-sm font-light text-(--body) transition hover:border-(--ink)/35"
                  }
                >
                  <span className="flex -space-x-1">
                    {["ink", "surface", "page"].map((key) => (
                      <span
                        key={key}
                        className="h-4 w-4 rounded-full border border-(--ink)/15"
                        style={{ background: preset.theme[key] }}
                      />
                    ))}
                  </span>
                  {preset.name}
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-(--muted-text)">
            Colors
          </p>
          {THEME_FIELDS.map((field) => (
            <ColorRow
              key={field.key}
              field={field}
              value={theme[field.key]}
              onChange={(value) => update({ [field.key]: value })}
            />
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-(--ink)/10 px-3 py-3 transition hover:border-(--ink)/25">
          <input
            type="checkbox"
            checked={theme.streaks !== false}
            onChange={(event) => update({ streaks: event.target.checked })}
            className="mt-0.5 accent-(--ink)"
          />
          <span>
            <span className="block text-sm font-medium text-(--heading)">Print streaks</span>
            <span className="block text-xs font-light text-(--muted-text)">
              The diagonal lines across the sidebar and dark panels. Uncheck for flat
              surfaces.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={reset} disabled={atDefault}>
            <RotateCcw className="h-4 w-4" />
            Reset to Printstream
          </Button>
          <span className="inline-flex items-center gap-1.5 text-xs font-light text-(--muted-text)">
            <Palette className="h-3.5 w-3.5" />
            {atDefault ? "Using the default palette" : "Custom palette active"}
          </span>
        </div>
      </div>
    </Card>
  );
}
