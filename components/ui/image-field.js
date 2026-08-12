"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * @param {{
 *   label: string;
 *   hint?: string;
 *   url: string;
 *   uploading?: boolean;
 *   disabled?: boolean;
 *   onUpload: (file: File) => void;
 *   onClear: () => void;
 * }} props
 */
export function ImageField({
  label,
  hint,
  url,
  uploading = false,
  disabled = false,
  onUpload,
  onClear,
}) {
  const inputRef = useRef(null);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-(--heading)">{label}</p>
      {hint ? <p className="text-xs text-(--muted-text)">{hint}</p> : null}
      {url ? (
        <div className="flex items-start gap-3 rounded-xl border border-(--ink)/10 bg-(--ink)/3 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="max-h-20 max-w-[180px] rounded-lg bg-white object-contain"
          />
          {!disabled ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading || disabled}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-(--ink)/20 bg-(--surface) px-4 py-6 text-sm text-(--muted-text) transition hover:border-(--ink)/40 hover:text-(--heading) disabled:cursor-not-allowed disabled:opacity-60"
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
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
