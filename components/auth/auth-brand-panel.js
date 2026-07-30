import { Mail } from "lucide-react";

/**
 * Shared Printstream auth panel (left half of login/signup).
 * @param {{
 *   title: string;
 *   description: string;
 *   footer?: string;
 * }} props
 */
export function AuthBrandPanel({ title, description, footer }) {
  return (
    <div className="ps-panel-ink ps-streaks relative hidden w-1/2 overflow-hidden lg:block">
      <div className="relative flex h-full flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="ps-chrome-tile flex h-10 w-10 items-center justify-center rounded-xl text-(--ink)">
            <Mail className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-[-0.02em] text-(--on-ink)">
            OutreachOS
          </span>
        </div>

        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-[-0.035em]">
            <span className="ps-chrome-text">{title}</span>
          </h1>
          <p className="text-base font-light leading-relaxed text-(--on-ink)/60">{description}</p>
        </div>

        <p className="text-[11px] font-light uppercase tracking-[0.2em] text-(--on-ink)/35">
          {footer || "Outreach, engineered."}
        </p>
      </div>
    </div>
  );
}
