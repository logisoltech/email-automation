import { cn } from "@/lib/utils/cn";

/**
 * @param {import("react").HTMLAttributes<HTMLDivElement> & {
 *   title?: string;
 *   description?: string;
 * }} props
 */
export function Card({ className, title, description, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-blue-100 bg-white p-6 shadow-sm shadow-blue-50",
        className
      )}
      {...props}
    >
      {(title || description) && (
        <div className="mb-4">
          {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </div>
  );
}
