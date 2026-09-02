import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  const v = (value || "unknown").toLowerCase();
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let extra = "";

  if (["approved", "completed", "accepted", "active", "awarded"].includes(v)) {
    variant = "secondary";
    extra = "bg-emerald-50 text-ok border-emerald-100";
  } else if (["pending", "unverified", "open"].includes(v)) {
    variant = "secondary";
    extra = "bg-amber-50 text-warn border-amber-100";
  } else if (["rejected", "failed", "declined", "suspended", "deletion_requested"].includes(v)) {
    variant = "destructive";
  } else if (["gold"].includes(v)) {
    variant = "default";
  }

  return (
    <Badge variant={variant} className={cn("capitalize", extra, className)}>
      {value || "—"}
    </Badge>
  );
}
