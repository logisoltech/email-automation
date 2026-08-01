import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * @param {{
 *   page: number;
 *   totalPages: number;
 *   total?: number;
 *   pageSize?: number;
 *   onPageChange: (page: number) => void;
 *   disabled?: boolean;
 *   className?: string;
 * }} props
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize = 10,
  onPageChange,
  disabled = false,
  className,
}) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = total ? Math.min(page * pageSize, total) : page * pageSize;

  return (
    <div
      className={
        className ||
        "flex flex-col gap-3 border-t border-(--ink)/10 pt-4 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <p className="text-xs font-light text-(--muted-text)">
        {total ? `Showing ${start}–${end} of ${total}` : `Page ${page} of ${totalPages}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="min-w-20 text-center text-xs font-medium text-(--heading)">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
