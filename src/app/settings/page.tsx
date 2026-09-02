import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePlanSettings } from "./actions";

export const dynamic = "force-dynamic";

const FIELDS: { name: string; label: string; hint?: string }[] = [
  { name: "monthly_credits", label: "Monthly Introductions" },
  { name: "rollover_cap", label: "Rollover cap", hint: "max unused Introductions carried into next cycle" },
  { name: "max_balance", label: "Maximum balance", hint: "hard cap regardless of rollover" },
  { name: "pending_request_limit", label: "Pending request limit", hint: "max active outgoing Introductions" },
  { name: "request_expiry_days", label: "Request expiry (days)" },
];

export default async function SettingsPage() {
  const plans = await prisma.plan_settings.findMany({ orderBy: { plan: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl font-medium tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Membership plan limits — changes take effect immediately for new requests and the next
          renewal cycle.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <Card key={p.plan}>
            <CardHeader>
              <CardTitle className="capitalize">{p.plan}</CardTitle>
              <CardDescription>
                Last updated {p.updated_at.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePlanSettings} className="space-y-3">
                <input type="hidden" name="plan" value={p.plan} />
                {FIELDS.map((f) => (
                  <label key={f.name} className="block text-sm">
                    <span className="block text-xs text-muted-foreground mb-1">
                      {f.label}
                      {f.hint ? <span className="opacity-70"> — {f.hint}</span> : null}
                    </span>
                    <Input
                      name={f.name}
                      type="number"
                      min={0}
                      defaultValue={p[f.name as keyof typeof p] as number}
                    />
                  </label>
                ))}
                <label className="block text-sm">
                  <span className="block text-xs text-muted-foreground mb-1">
                    Saved profile limit — blank = unlimited
                  </span>
                  <Input
                    name="saved_profile_limit"
                    type="number"
                    min={0}
                    defaultValue={p.saved_profile_limit ?? ""}
                  />
                </label>
                <Button type="submit">Save {p.plan} settings</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
