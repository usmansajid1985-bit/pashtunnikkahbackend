import { roadmapDocs, roadmapStats, type RoadmapStatus } from "@/lib/roadmap-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const STATUS_META: Record<RoadmapStatus, { label: string; badge: "secondary" | "outline" | "destructive" }> = {
  done: { label: "Done", badge: "secondary" },
  partial: { label: "Partial", badge: "outline" },
  todo: { label: "Not started", badge: "destructive" },
};

function StatusDot({ status }: { status: RoadmapStatus }) {
  const color = status === "done" ? "bg-emerald-500" : status === "partial" ? "bg-amber-500" : "bg-rose-300";
  return <span className={`inline-block size-2 rounded-full ${color} shrink-0`} />;
}

export default function RoadmapPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Roadmap</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live progress against spec documents, audited against the actual codebase — not
          aspirational.
        </p>
      </div>

      {roadmapDocs.map((doc) => {
        const stats = roadmapStats(doc);
        return (
          <div key={doc.slug} className="space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{doc.title}</CardTitle>
                  <CardDescription className="mt-1">
                    Source: {doc.source} · Last audited {doc.lastUpdated}
                  </CardDescription>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-3xl font-heading font-medium tabular-nums">{stats.scorePct}%</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.done} done · {stats.partial} partial · {stats.todo} not started
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-rose-400"
                    style={{ width: `${stats.scorePct}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              {doc.sections.map((section) => {
                const sDone = section.items.filter((i) => i.status === "done").length;
                const sTotal = section.items.length;
                return (
                  <Card key={section.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          {sDone}/{sTotal}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {section.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-1">
                            <StatusDot status={item.status} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={item.status === "done" ? "" : "text-foreground"}>{item.label}</span>
                              <Badge variant={STATUS_META[item.status].badge} className="text-[10px]">
                                {STATUS_META[item.status].label}
                              </Badge>
                            </div>
                            {item.note ? (
                              <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>
                            ) : null}
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
      })}

      <p className="text-xs text-muted-foreground">
        Full write-up with file:line evidence: <code>docs/MEMBERSHIP_MATCHING_SPEC.md</code> in
        the project root.
      </p>
    </div>
  );
}
