import { cn } from "@/lib/utils/cn";

/**
 * @param {import("react").HTMLAttributes<HTMLDivElement> & {
 *   title?: string;
 *   description?: string;
 * }} props
 */
export function Card({ className, title, description, children, ...props }) {
  return (
    <div className={cn("ps-card relative p-6", className)} {...props}>
      {title ? (
        <div className="relative mb-5">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-(--heading)">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm font-light text-(--muted-text)">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
