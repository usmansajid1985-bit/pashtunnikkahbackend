import Link from "next/link";
import {
  qaChecklistMeta,
  qaSections,
  qaStats,
  type QaItem,
  type QaPriority,
  type QaStatus,
} from "@/lib/qa-checklist-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_META: Record<QaStatus, { label: string; badge: "secondary" | "outline" | "destructive"; dot: string }> = {
  done: { label: "Done", badge: "secondary", dot: "bg-emerald-500" },
  in_progress: { label: "In progress", badge: "outline", dot: "bg-amber-500" },
  todo: { label: "To do", badge: "destructive", dot: "bg-rose-300" },
};

const PRI_CLASS: Record<QaPriority, string> = {
  CRIT: "bg-rose-600 text-white",
  HIGH: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  STD: "bg-muted text-muted-foreground",
};

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "crit", label: "Critical open" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function matches(item: QaItem, filter: FilterKey) {
  switch (filter) {
    case "open":
      return item.status !== "done";
    case "crit":
      return item.pri === "CRIT" && item.status !== "done";
    case "in_progress":
      return item.status === "in_progress";
    case "done":
      return item.status === "done";
    default:
      return true;
  }
}

export default async function QaChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f } = await searchParams;
  const filter: FilterKey = FILTERS.some((x) => x.key === f) ? (f as FilterKey) : "open";
  const stats = qaStats();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">QA Checklist</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Failed, partial and blocked checks from the client&apos;s V2 QA pass. Passing checks are
          omitted.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{qaChecklistMeta.title}</CardTitle>
            <CardDescription className="mt-1">
              Source: {qaChecklistMeta.source} · Last updated {qaChecklistMeta.lastUpdated}
            </CardDescription>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-heading font-medium tabular-nums">{stats.pct}%</p>
            <p className="text-xs text-muted-foreground">
              {stats.done} done · {stats.inProgress} in progress · {stats.todo} to do
            </p>
            <p className="text-xs font-medium text-rose-600 mt-0.5">{stats.critOpen} critical open</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-rose-400"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key === "open" ? "/qa-checklist" : `/qa-checklist?f=${x.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition",
              filter === x.key
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <div className="space-y-5">
        {qaSections.map((section) => {
          const items = section.items.filter((i) => matches(i, filter));
          if (items.length === 0) return null;
          const sDone = section.items.filter((i) => i.status === "done").length;
          return (
            <Card key={section.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {sDone}/{section.items.length} done
                  </span>
                </div>
              </CardHeader>
              <CardContent className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 py-3 text-sm first:pt-0 last:pb-0">
                    <span className={`mt-1.5 inline-block size-2 rounded-full shrink-0 ${STATUS_META[item.status].dot}`} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", PRI_CLASS[item.pri])}>
                          {item.pri}
                        </span>
                        <span className={cn("font-medium", item.status === "done" && "line-through text-muted-foreground")}>
                          {item.title}
                        </span>
                        <Badge variant={STATUS_META[item.status].badge} className="text-[10px]">
                          {STATUS_META[item.status].label}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          QA: {item.qa}
                        </span>
                      </div>
                      {item.dupOf ? (
                        <p className="text-xs text-muted-foreground">Same defect as {item.dupOf} — resolves with it.</p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">QA saw:</span> {item.issue}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/80">Fix:</span> {item.fix}
                          </p>
                        </>
                      )}
                      {item.note ? <p className="text-xs text-emerald-700 dark:text-emerald-400">✓ {item.note}</p> : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
