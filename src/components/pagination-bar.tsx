import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  basePath: string;
  searchParams?: Record<string, string | undefined>;
};

function hrefFor(basePath: string, page: number, searchParams?: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  Object.entries(searchParams || {}).forEach(([k, v]) => {
    if (v && k !== "page") sp.set(k, v);
  });
  if (page > 1) sp.set("page", String(page));
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function PaginationBar({ page, totalPages, total, basePath, searchParams }: Props) {
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
        <span className="mx-1.5">·</span>
        {total.toLocaleString()} total
      </p>
      <div className="flex items-center gap-2">
        {canPrev ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefFor(basePath, prev, searchParams)} />}
          >
            <ChevronLeft />
            Prev
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft />
            Prev
          </Button>
        )}
        {canNext ? (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={hrefFor(basePath, next, searchParams)} />}
          >
            Next
            <ChevronRight />
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}
