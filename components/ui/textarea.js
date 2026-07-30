import { cn } from "@/lib/utils/cn";

/**
 * @param {import("react").TextareaHTMLAttributes<HTMLTextAreaElement> & {
 *   label?: string;
 *   error?: string;
 *   hint?: string;
 * }} props
 */
export function Textarea({ className, label, error, hint, id, ...props }) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium tracking-[-0.01em] text-(--heading)"
        >
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        className={cn(
          "flex min-h-[120px] w-full rounded-xl border border-(--ink)/12 bg-(--surface) px-3.5 py-2.5 text-sm text-(--heading) shadow-[0_1px_0_var(--surface)_inset] transition placeholder:text-(--muted-text) focus:border-(--ink) focus:outline-none focus:ring-2 focus:ring-(--ink)/10",
          error && "border-red-300 focus:border-red-500 focus:ring-red-100",
          className
        )}
        {...props}
      />
      {hint && !error ? <p className="text-xs font-light text-(--muted-text)">{hint}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
