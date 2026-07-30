import { cn } from "@/lib/utils/cn";

/**
 * @param {import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
 *   variant?: "primary" | "secondary" | "ghost" | "danger";
 *   size?: "sm" | "md" | "lg";
 *   loading?: boolean;
 * }} props
 */
export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}) {
  const variants = {
    primary:
      "bg-(--ink) text-(--on-ink) hover:bg-(--ink-soft) focus-visible:ring-(--ink) shadow-[0_10px_24px_-14px_rgba(10,10,12,0.9)]",
    secondary:
      "border border-(--ink)/15 bg-(--surface) text-(--ink)! hover:bg-(--surface-lo) focus-visible:ring-(--ink)",
    ghost:
      "text-(--body) hover:bg-(--ink)/5 hover:text-(--heading) focus-visible:ring-(--ink)",
    danger: "bg-red-600 text-(--on-ink) hover:bg-red-700 focus-visible:ring-red-500 shadow-sm",
  };

  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
